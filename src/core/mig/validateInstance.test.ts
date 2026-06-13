import { describe, expect, it } from "vitest"
import type {
  Code,
  ElementOverrides,
  MessageDefinition,
  MessageElement,
} from "@/core/types/types"
import { validateMessageInstance, type InstanceNode } from "./validateInstance"

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

const codes = (...names: string[]): Code[] => names.map((codeName) => ({ codeName, definition: "" }))

const MESSAGE: MessageDefinition = {
  name: "CreditTransfer",
  identifier: "pacs.008.001.08",
  shortCode: "pacs.008",
  rootElement: el("Doc", {
    elements: [
      el("GrpHdr", { baseType: "Text", maxLength: 35 }),
      el("Amt", { baseType: "Amount", minInclusive: 0, maxInclusive: 1000 }),
      el("Sts", { baseType: "CodeSet", minOccurs: 0, codes: codes("ACTV", "INAC") }),
    ],
  }),
}

function node(localName: string, props: Partial<InstanceNode> = {}): InstanceNode {
  return { localName, attributes: {}, text: "", children: [], ...props }
}

const leaf = (localName: string, text: string) => node(localName, { text })

function run(root: InstanceNode, overrides: ElementOverrides = {}) {
  return validateMessageInstance(root, MESSAGE, overrides)
}

const valid = () =>
  node("Doc", { children: [leaf("GrpHdr", "ABC"), leaf("Amt", "500"), leaf("Sts", "ACTV")] })

describe("validateMessageInstance", () => {
  it("accepts a conforming instance", () => {
    expect(run(valid())).toEqual([])
  })

  it("flags a root that doesn't match the message", () => {
    expect(run(node("Other"))[0]).toMatchObject({ message: expect.stringMatching(/does not match/i) })
  })

  it("flags missing required and over-max cardinality", () => {
    // No GrpHdr/Amt (both required), two Sts (max 1).
    const d = run(node("Doc", { children: [leaf("Sts", "ACTV"), leaf("Sts", "INAC")] }))
    expect(d).toContainEqual(
      expect.objectContaining({ path: "Doc/GrpHdr", message: expect.stringMatching(/minimum is 1/i) }),
    )
    expect(d).toContainEqual(
      expect.objectContaining({ path: "Doc/Amt", message: expect.stringMatching(/minimum is 1/i) }),
    )
    expect(d).toContainEqual(
      expect.objectContaining({ path: "Doc/Sts", message: expect.stringMatching(/maximum is 1/i) }),
    )
  })

  it("flags an element the MIG excludes but the instance still contains", () => {
    const d = run(valid(), { "Doc/Sts": { maxOccurs: 0 } })
    expect(d[0]).toMatchObject({ path: "Doc/Sts", message: expect.stringMatching(/excluded.*appears 1/i) })
  })

  it("flags a value outside the code set, length, and inclusive range", () => {
    expect(run(node("Doc", { children: [leaf("GrpHdr", "x"), leaf("Amt", "500"), leaf("Sts", "ZZZ")] })))
      .toContainEqual(expect.objectContaining({ path: "Doc/Sts", message: expect.stringMatching(/not an allowed value/i) }))
    expect(run(node("Doc", { children: [leaf("GrpHdr", "x".repeat(40)), leaf("Amt", "500")] })))
      .toContainEqual(expect.objectContaining({ path: "Doc/GrpHdr", message: expect.stringMatching(/max length 35/i) }))
    expect(run(node("Doc", { children: [leaf("GrpHdr", "x"), leaf("Amt", "2000")] })))
      .toContainEqual(expect.objectContaining({ path: "Doc/Amt", message: expect.stringMatching(/above the maximum 1000/i) }))
  })

  it("validates against the effective (tightened) MIG facets", () => {
    // MIG tightens GrpHdr maxLength to 5; a length-8 value violates it.
    const d = run(node("Doc", { children: [leaf("GrpHdr", "12345678"), leaf("Amt", "500")] }), {
      "Doc/GrpHdr": { maxLength: 5 },
    })
    expect(d).toContainEqual(
      expect.objectContaining({ path: "Doc/GrpHdr", message: expect.stringMatching(/max length 5/i) }),
    )
  })

  it("flags an element not declared in the message", () => {
    const d = run(node("Doc", { children: [leaf("GrpHdr", "x"), leaf("Amt", "500"), leaf("Bogus", "y")] }))
    expect(d).toContainEqual(
      expect.objectContaining({ path: "Doc", message: expect.stringMatching(/unexpected element <Bogus>/i) }),
    )
  })
})
