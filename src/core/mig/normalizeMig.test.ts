import { describe, expect, it } from "vitest"
import type {
  ERepository,
  MessageElement,
  MessageImplementationGuide,
} from "@/core/types/types"
import { normalizeMig } from "./normalizeMig"
import { serializeMig } from "./serializeMig"

function el(
  xmlTag: string,
  over: Partial<MessageElement> = {}
): MessageElement {
  return {
    id: xmlTag,
    name: xmlTag,
    xmlTag,
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
    ...over,
  }
}

const root = el("Doc", {
  elements: [
    el("Amt", {
      baseType: "Amount",
      minOccurs: 1,
      maxOccurs: 1,
      minLength: 1,
      maxLength: 35,
      definition: "The amount.",
    }),
    el("Ccy", {
      baseType: "CodeSet",
      codes: [
        { codeName: "EUR", definition: "" },
        { codeName: "USD", definition: "" },
        { codeName: "GBP", definition: "" },
      ],
    }),
  ],
})

const REPO: ERepository = {
  businessAreas: [
    {
      name: "Payments Clearing",
      code: "pacs",
      definition: "",
      messages: [
        {
          name: "CreditTransferV08",
          shortCode: "pacs.008",
          identifier: "pacs.008.001.08",
          rootElement: root,
        },
      ],
    },
  ],
}

function mig(
  over: Partial<MessageImplementationGuide> = {}
): MessageImplementationGuide {
  return {
    name: "M",
    version: "1",
    messageIdentifier: "pacs.008.001.08",
    elementOverrides: {},
    ...over,
  }
}

const normalize = (m: MessageImplementationGuide, all = [m]) =>
  normalizeMig(m, REPO, all)

describe("normalizeMig — ISO baseline", () => {
  it("drops a facet equal to the ISO baseline, removing the now-empty path", () => {
    const out = normalize(mig({ elementOverrides: { "/Doc/Amt": { minOccurs: 1 } } }))
    expect(out.elementOverrides).toEqual({})
  })

  it("keeps a facet that deviates from the standard", () => {
    const out = normalize(mig({ elementOverrides: { "/Doc/Amt": { maxOccurs: 0 } } }))
    expect(out.elementOverrides).toEqual({ "/Doc/Amt": { maxOccurs: 0 } })
  })

  it("drops a definition identical to ISO but keeps a changed one", () => {
    const same = normalize(
      mig({ elementOverrides: { "/Doc/Amt": { definition: "The amount." } } })
    )
    expect(same.elementOverrides).toEqual({})
    const diff = normalize(
      mig({ elementOverrides: { "/Doc/Amt": { definition: "Settled amount." } } })
    )
    expect(diff.elementOverrides).toEqual({
      "/Doc/Amt": { definition: "Settled amount." },
    })
  })

  it("drops allowedValues equal to the ISO code set, keeps a subset", () => {
    const same = normalize(
      mig({
        elementOverrides: {
          "/Doc/Ccy": { allowedValues: ["EUR", "USD", "GBP"] },
        },
      })
    )
    expect(same.elementOverrides).toEqual({})
    const subset = normalize(
      mig({ elementOverrides: { "/Doc/Ccy": { allowedValues: ["EUR"] } } })
    )
    expect(subset.elementOverrides).toEqual({
      "/Doc/Ccy": { allowedValues: ["EUR"] },
    })
  })
})

describe("normalizeMig — inherited baseline", () => {
  const parent = mig({
    name: "Parent",
    elementOverrides: { "/Doc/Amt": { maxLength: 10 } },
  })

  it("prunes a field equal to the inherited value", () => {
    const child = mig({
      name: "Child",
      parentMIG: "Parent:1",
      elementOverrides: { "/Doc/Amt": { maxLength: 10 } },
    })
    const out = normalizeMig(child, REPO, [child, parent])
    expect(out.elementOverrides).toEqual({})
  })

  it("keeps a field that differs from the inherited value", () => {
    const child = mig({
      name: "Child",
      parentMIG: "Parent:1",
      elementOverrides: { "/Doc/Amt": { maxLength: 5 } },
    })
    const out = normalizeMig(child, REPO, [child, parent])
    expect(out.elementOverrides).toEqual({ "/Doc/Amt": { maxLength: 5 } })
  })
})

describe("normalizeMig — tri-state and unknowns", () => {
  it("keeps an explicit null that differs from the baseline", () => {
    // element.minLength is 1, so `minLength: null` (clear) is a real change.
    const out = normalize(
      mig({ elementOverrides: { "/Doc/Amt": { minLength: null } } })
    )
    expect(out.elementOverrides).toEqual({ "/Doc/Amt": { minLength: null } })
  })

  it("drops an explicit null that equals the baseline", () => {
    // element.pattern is null, so `pattern: null` matches the baseline.
    const out = normalize(
      mig({ elementOverrides: { "/Doc/Amt": { pattern: null } } })
    )
    expect(out.elementOverrides).toEqual({})
  })

  it("leaves an override on an absent path untouched", () => {
    const out = normalize(
      mig({ elementOverrides: { "/Doc/Missing": { minOccurs: 1 } } })
    )
    expect(out.elementOverrides).toEqual({ "/Doc/Missing": { minOccurs: 1 } })
  })

  it("returns the MIG unchanged when the message can't be resolved", () => {
    const m = mig({
      messageIdentifier: "nope.999",
      elementOverrides: { "/Doc/Amt": { minOccurs: 1 } },
    })
    expect(normalize(m)).toBe(m)
  })
})

describe("normalizeMig — constraint cleanup and round-trip", () => {
  it("tidies a MIG-added constraint to its minimal form", () => {
    const out = normalize(
      mig({
        elementOverrides: {
          "/Doc/Amt": {
            additionalConstraints: {
              R1: { definition: "d", expression: "", enabled: true, annotations: {} },
            },
          },
        },
      })
    )
    expect(out.elementOverrides).toEqual({
      "/Doc/Amt": { additionalConstraints: { R1: { definition: "d" } } },
    })
  })

  it("produces slim YAML — no-op facets gone, real ones kept", () => {
    const out = normalize(
      mig({
        elementOverrides: {
          "/Doc/Amt": { minOccurs: 1, maxOccurs: 0 },
        },
      })
    )
    const yaml = serializeMig(out)
    expect(yaml).not.toContain("minOccurs")
    expect(yaml).toContain("maxOccurs")
  })

  it("does not mutate the input MIG", () => {
    const m = mig({ elementOverrides: { "/Doc/Amt": { minOccurs: 1 } } })
    normalize(m)
    expect(m.elementOverrides).toEqual({ "/Doc/Amt": { minOccurs: 1 } })
  })
})
