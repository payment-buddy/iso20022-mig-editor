import { describe, expect, it } from "vitest"
import type {
  Code,
  ElementOverrides,
  MessageDefinition,
  MessageElement,
  MessageImplementationGuide,
} from "@/core/types/types"
import { effectiveMig } from "./effectiveMig"
import { diffMig, type ElementDiff } from "./migDiff"

function el(name: string, props: Partial<MessageElement> = {}): MessageElement {
  return {
    id: name,
    name,
    xmlTag: name,
    isAttribute: false,
    definition: "",
    minOccurs: 1,
    maxOccurs: 1,
    typeId: "",
    type: "",
    baseType: null,
    minInclusive: null,
    maxInclusive: null,
    totalDigits: null,
    fractionDigits: null,
    length: null,
    minLength: null,
    maxLength: null,
    pattern: null,
    baseValue: null,
    codes: [],
    constraints: [],
    examples: [],
    elements: [],
    ...props,
  }
}

const codes = (...names: string[]): Code[] =>
  names.map((codeName) => ({ codeName, definition: "" }))

const MESSAGE: MessageDefinition = {
  name: "CreditTransfer",
  identifier: "pacs.008.001.08",
  shortCode: "pacs.008",
  rootElement: el("Doc", {
    elements: [
      el("Amt", { baseType: "Amount" }),
      el("GrpHdr", {
        baseType: "Text",
        maxLength: 35,
        definition: "Group header",
        constraints: [
          { name: "StdRule", definition: "std" },
          { name: "OffRule", definition: "off" },
        ],
      }),
      el("Sts", { baseType: "CodeSet", codes: codes("ACTV", "INAC", "PEND") }),
    ],
  }),
}

function diffOf(elementOverrides: ElementOverrides) {
  const mig: MessageImplementationGuide = {
    name: "EPC",
    version: "1.0",
    messageIdentifier: "pacs.008.001.08",
    elementOverrides,
  }
  return diffMig(effectiveMig(mig, [mig]), MESSAGE)
}

const only = (elementOverrides: ElementOverrides): ElementDiff =>
  diffOf(elementOverrides).elements[0]

describe("diffMig field classification", () => {
  it("classifies a narrowed bound as tightened, a widened one as loosened", () => {
    expect(only({ "/Doc/GrpHdr": { maxLength: 20 } }).changes).toEqual([
      { label: "Max length", kind: "tightened", baseline: "35", value: "20" },
    ])
    expect(only({ "/Doc/GrpHdr": { maxLength: 50 } }).changes[0].kind).toBe(
      "loosened"
    )
    expect(only({ "/Doc/GrpHdr": { minOccurs: 0 } }).changes[0].kind).toBe(
      "loosened"
    )
  })

  it("classifies a removed (null) constraint", () => {
    const change = only({ "/Doc/GrpHdr": { maxLength: null } }).changes[0]
    expect(change).toMatchObject({
      label: "Max length",
      kind: "removed",
      value: "none",
    })
  })

  it("marks maxOccurs 0 as excluded and skips field changes", () => {
    const d = only({ "/Doc/Amt": { maxOccurs: 0 } })
    expect(d.excluded).toBe(true)
    expect(d.changes).toEqual([])
  })

  it("treats an allowed-values subset as tightened, a non-subset as loosened", () => {
    expect(
      only({ "/Doc/Sts": { allowedValues: ["ACTV"] } }).changes[0].kind
    ).toBe("tightened")
    expect(
      only({ "/Doc/Sts": { allowedValues: ["ACTV", "NEW"] } }).changes[0].kind
    ).toBe("loosened")
  })

  it("classifies pattern add / change / remove", () => {
    expect(only({ "/Doc/GrpHdr": { pattern: "[A-Z]+" } }).changes[0].kind).toBe(
      "added"
    )
  })

  it("treats definition as an informational change and annotations as added", () => {
    const d = only({
      "/Doc/GrpHdr": {
        definition: "Bank rule",
        annotations: { Usage: "debit" },
      },
    })
    expect(d.changes).toEqual([
      {
        label: "Definition",
        kind: "changed",
        baseline: "Group header",
        value: "Bank rule",
      },
      { label: "Usage", kind: "added", baseline: "—", value: "debit" },
    ])
  })

  it("carries additional constraints with expression and annotations", () => {
    const d = only({
      "/Doc/GrpHdr": {
        additionalConstraints: {
          R: {
            definition: "must hold",
            expression: "x > 0",
            annotations: { Severity: "high" },
          },
        },
      },
    })
    expect(d.constraints).toEqual([
      {
        name: "R",
        definition: "must hold",
        expression: "x > 0",
        annotations: [{ name: "Severity", value: "high" }],
        source: "added",
      },
    ])
  })

  it("carries an overlaid standard constraint and marks a disabled one", () => {
    const d = only({
      "/Doc/GrpHdr": {
        constraintOverrides: {
          StdRule: { expression: "x > 0" },
          OffRule: { disabled: true },
        },
      },
    })
    // GrpHdr's ISO constraints (defined in the test message below) are StdRule + OffRule.
    expect(d.constraints).toContainEqual(
      expect.objectContaining({
        name: "StdRule",
        expression: "x > 0",
        source: "standard",
      })
    )
    expect(d.constraints).toContainEqual(
      expect.objectContaining({
        name: "OffRule",
        source: "standard",
        disabled: true,
      })
    )
  })
})

describe("diffMig structure", () => {
  it("emits elements in message schema order and counts loosenings", () => {
    const diff = diffOf({
      "/Doc/Sts": { allowedValues: ["ACTV", "NEW"] }, // loosened
      "/Doc/GrpHdr": { maxLength: 20 }, // tightened
    })
    expect(diff.elements.map((e) => e.name)).toEqual(["GrpHdr", "Sts"]) // GrpHdr precedes Sts
    expect(diff.loosenings).toBe(1)
  })

  it("reports an override path that isn't in the message as an orphan", () => {
    const diff = diffOf({ "/Doc/Ghost": { minOccurs: 0 } })
    expect(diff.elements[0]).toMatchObject({
      path: "/Doc/Ghost",
      name: "Ghost",
      orphan: true,
    })
  })

  it("lists parent keys and merges the chain for the diff", () => {
    const parent: MessageImplementationGuide = {
      name: "Base",
      version: "1",
      messageIdentifier: "pacs.008.001.08",
      elementOverrides: { "/Doc/GrpHdr": { maxLength: 30 } },
    }
    const leaf: MessageImplementationGuide = {
      name: "EPC",
      version: "1.0",
      messageIdentifier: "pacs.008.001.08",
      parentMIG: "Base:1",
      elementOverrides: { "/Doc/GrpHdr": { minOccurs: 1, maxLength: 20 } },
    }
    const diff = diffMig(effectiveMig(leaf, [leaf, parent]), MESSAGE)
    expect(diff.mig.parents).toEqual(["Base:1"])
    // Effective maxLength is the leaf's 20 (vs ISO 35).
    expect(
      diff.elements[0].changes.find((c) => c.label === "Max length")
    ).toMatchObject({
      value: "20",
    })
  })

  it("flags an unloaded parent", () => {
    const leaf: MessageImplementationGuide = {
      name: "EPC",
      version: "1.0",
      messageIdentifier: "pacs.008.001.08",
      parentMIG: "Missing:9",
      elementOverrides: {},
    }
    expect(diffMig(effectiveMig(leaf, [leaf]), MESSAGE).missingParent).toBe(
      "Missing:9"
    )
  })
})
