import { describe, expect, it } from "vitest"
import type {
  ERepository,
  MessageDefinition,
  MessageElement,
  MessageImplementationGuide,
} from "@/core/types/types"
import { searchMigs } from "./searchMigs"

function el(
  p: Partial<MessageElement> & { name: string; xmlTag: string }
): MessageElement {
  return {
    id: p.xmlTag,
    isAttribute: false,
    definition: "",
    minOccurs: 0,
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
    ...p,
  }
}

const message: MessageDefinition = {
  name: "FIToFICstmrCdtTrf",
  identifier: "pacs.008.001.08",
  shortCode: "pacs.008",
  rootElement: el({
    name: "Document",
    xmlTag: "Document",
    elements: [
      el({
        name: "Debtor",
        xmlTag: "Dbtr",
        definition: "Name of the debtor party",
      }),
    ],
  }),
}

const repo: ERepository = {
  businessAreas: [
    { name: "Payments", code: "pacs", definition: "", messages: [message] },
  ],
}

const mig: MessageImplementationGuide = {
  name: "My CT",
  version: "1.0",
  messageIdentifier: "pacs.008.001.08",
  elementOverrides: {
    "/Document/Dbtr": {
      definition: "Local debtor rules",
      allowedValues: ["AAAA", "BBBB"],
      annotations: { Usage: "mandatory for domestic" },
      additionalConstraints: [
        {
          name: "DbtrRule",
          definition: "debtor must be a bank",
          annotations: { Rationale: "scheme requires settlement agent" },
        },
      ],
    },
  },
}

describe("searchMigs", () => {
  it("returns nothing for a too-short query", () => {
    expect(searchMigs(repo, [mig], "d")).toEqual([])
  })

  it("matches an annotation value, resolving the element name from the message", () => {
    const hits = searchMigs(repo, [mig], "domestic")
    expect(hits).toHaveLength(1)
    const h = hits[0]
    expect(h.field).toBe("annotation")
    expect(h.detail).toBe("Usage")
    expect(h.xmlPath).toBe("/Document/Dbtr")
    expect(h.elementName).toBe("Debtor")
    expect(h.migKey).toBe("My CT:1.0")
  })

  it("matches the MIG name with no element path", () => {
    const hits = searchMigs(repo, [mig], "My CT")
    expect(hits).toHaveLength(1)
    expect(hits[0].field).toBe("name")
    expect(hits[0].xmlPath).toBeUndefined()
  })

  it("matches allowed values and the override definition", () => {
    expect(searchMigs(repo, [mig], "AAAA")[0].field).toBe("allowedValue")
    expect(searchMigs(repo, [mig], "local debtor")[0].field).toBe("definition")
  })

  it("matches a constraint's annotation value, targeting the constraint node", () => {
    const hits = searchMigs(repo, [mig], "settlement agent")
    expect(hits).toHaveLength(1)
    const h = hits[0]
    expect(h.field).toBe("annotation")
    expect(h.detail).toBe("Rationale")
    // Navigates to the constraint node, where the annotation is edited.
    expect(h.xmlPath).toBe("/Document/Dbtr/DbtrRule")
  })

  it("does not match the underlying standard message fields", () => {
    // 'party' appears only in the base message definition, never in the override.
    expect(searchMigs(repo, [mig], "party")).toEqual([])
  })

  it("anchors a whole word when the query has an edge space", () => {
    // "domestic" is the last word of the Usage annotation value.
    const whole = searchMigs(repo, [mig], "domestic ")
    expect(whole).toHaveLength(1)
    expect(whole[0].field).toBe("annotation")

    // A prefix that isn't a whole word matches nothing once anchored…
    expect(searchMigs(repo, [mig], "domesti ")).toEqual([])
    // …but the same prefix without the space still matches (unchanged behavior).
    expect(searchMigs(repo, [mig], "domesti")[0].field).toBe("annotation")

    // A leading space anchors the start (override definition "Local debtor…").
    expect(searchMigs(repo, [mig], " local")[0].field).toBe("definition")
  })
})
