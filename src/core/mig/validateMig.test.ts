import { describe, expect, it } from "vitest"
import type {
  Code,
  ElementOverrides,
  MessageDefinition,
  MessageElement,
  MessageImplementationGuide,
} from "@/core/types/types"
import { validateMigConsistency } from "./validateMig"

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
      el("GrpHdr", { baseType: "Text", maxLength: 35 }), // mandatory (minOccurs 1)
      el("Amt", { baseType: "Amount", fractionDigits: 2 }),
      el("Sts", { baseType: "CodeSet", codes: codes("ACTV", "INAC") }),
      el("Opt", { minOccurs: 0 }), // optional
    ],
  }),
}

function run(overrides: ElementOverrides, inherited: ElementOverrides = {}) {
  const mig: MessageImplementationGuide = {
    name: "EPC",
    version: "1.0",
    messageIdentifier: "pacs.008.001.08",
    elementOverrides: overrides,
  }
  return validateMigConsistency(mig, inherited, MESSAGE)
}

describe("validateMigConsistency", () => {
  it("returns nothing for a clean (tightening) MIG", () => {
    expect(run({ "Doc/GrpHdr": { maxLength: 20 } })).toEqual([]) // tighter than 35
  })

  it("flags a loosened facet against the ISO baseline", () => {
    const d = run({ "Doc/GrpHdr": { maxLength: 50 } })
    expect(d).toEqual([
      {
        path: "Doc/GrpHdr",
        elementName: "GrpHdr",
        field: "Max length",
        message: expect.stringMatching(/above 35/i),
      },
    ])
  })

  it("flags a lowered min facet", () => {
    expect(run({ "Doc/GrpHdr": { minOccurs: 0 } })[0]).toMatchObject({
      field: "Min occurs",
      message: expect.stringMatching(/below 1/i),
    })
  })

  it("flags empty ranges, including an exclusion that still requires the element", () => {
    expect(run({ "Doc/GrpHdr": { minLength: 10, maxLength: 5 } })[0]).toMatchObject({
      field: "Max length",
      message: expect.stringMatching(/length: max 5 is below min 10/i),
    })
    // A positive max below min occurs.
    expect(run({ "Doc/GrpHdr": { minOccurs: 2, maxOccurs: 1 } })[0]).toMatchObject({
      field: "Max occurs",
      message: expect.stringMatching(/occurs: max 1 is below min 2/i),
    })
    // Excluding a mandatory element (min 1) without zeroing min is contradictory.
    expect(run({ "Doc/GrpHdr": { maxOccurs: 0 } })[0]).toMatchObject({
      field: "Max occurs",
      message: expect.stringMatching(/excluded.*min occurs is 1.*set min occurs to 0/i),
    })
    // A clean exclusion of an optional element (min already 0) is fine.
    expect(run({ "Doc/Opt": { maxOccurs: 0 } })).toEqual([])
  })

  it("flags an invalid pattern and a non-subset allowed-values list", () => {
    expect(run({ "Doc/GrpHdr": { pattern: "[" } })[0]).toMatchObject({
      field: "Pattern",
      message: expect.stringMatching(/invalid pattern/i),
    })
    expect(run({ "Doc/Sts": { allowedValues: ["ACTV", "NEW"] } })[0]).toMatchObject({
      field: "Allowed values",
      message: expect.stringMatching(/outside the standard set: NEW/i),
    })
    expect(run({ "Doc/Sts": { allowedValues: ["ACTV"] } })).toEqual([]) // subset is fine
  })

  it("loosens against the inherited baseline, not just ISO", () => {
    const inherited: ElementOverrides = { "Doc/GrpHdr": { maxLength: 20 } }
    // 30 is tighter than ISO 35 but looser than the inherited 20 → flagged.
    expect(run({ "Doc/GrpHdr": { maxLength: 30 } }, inherited)[0]).toMatchObject({
      field: "Max length",
      message: expect.stringMatching(/above 20/i),
    })
  })

  it("ignores override paths absent from the message", () => {
    expect(run({ "Doc/Ghost": { minOccurs: 0 } })).toEqual([])
  })

  it("aggregates diagnostics across paths", () => {
    const d = run({ "Doc/GrpHdr": { maxLength: 50 }, "Doc/Amt": { fractionDigits: 5 } })
    expect(d).toHaveLength(2)
    expect(d.map((x) => x.elementName).sort()).toEqual(["Amt", "GrpHdr"])
  })
})
