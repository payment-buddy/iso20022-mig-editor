import { describe, expect, it } from "vitest"
import type {
  ERepository,
  MessageDefinition,
  MessageElement,
} from "@/core/types/types"
import {
  isMessageIndexReady,
  prewarmMessageIndex,
  searchMessages,
} from "./searchMessages"

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

// One pacs.008 family with three versions. The Dbtr definition is reworded at
// .08 (so .06 differs), while Purp is identical across versions.
function version(identifier: string, dbtrDef: string): MessageDefinition {
  return {
    name: "FIToFICstmrCdtTrf",
    identifier,
    shortCode: "pacs.008",
    rootElement: el({
      name: "Document",
      xmlTag: "Document",
      elements: [
        el({ name: "Debtor", xmlTag: "Dbtr", definition: dbtrDef }),
        el({
          name: "Purpose",
          xmlTag: "Purp",
          codes: [
            { codeName: "SCOR", definition: "Structured creditor reference" },
          ],
          constraints: [
            { name: "Rule1", definition: "must be present", expression: "x" },
          ],
        }),
      ],
    }),
  }
}

const repo: ERepository = {
  businessAreas: [
    {
      name: "Payments Clearing and Settlement",
      code: "pacs",
      definition: "",
      messages: [
        version("pacs.008.001.06", "Name of the debtor"),
        version("pacs.008.001.07", "Name of the debtor party"),
        version("pacs.008.001.08", "Name of the debtor party"),
      ],
    },
  ],
}

describe("searchMessages", () => {
  it("returns nothing for a too-short query", () => {
    expect(searchMessages(repo, "d")).toEqual([])
  })

  it("dedupes a definition match across identical versions into one cluster", () => {
    const hits = searchMessages(repo, "debtor party")
    expect(hits).toHaveLength(1)
    const h = hits[0]
    expect(h.field).toBe("definition")
    expect(h.shortCode).toBe("pacs.008")
    expect(h.xmlPath).toBe("/Document/Dbtr")
    expect(h.latestIdentifier).toBe("pacs.008.001.08")
    expect(h.clusters).toHaveLength(1)
    expect(h.clusters[0].versions.map((v) => v.identifier)).toEqual([
      "pacs.008.001.08",
      "pacs.008.001.07",
    ])
  })

  it("groups divergent values into separate clusters, newest first", () => {
    const hits = searchMessages(repo, "debtor")
    // Structural name match outranks the prose definition match.
    expect(hits[0].field).toBe("name")
    const def = hits.find((h) => h.field === "definition")
    expect(def).toBeDefined()
    expect(def!.clusters).toHaveLength(2)
    expect(def!.clusters[0].versions.map((v) => v.short)).toEqual(["08", "07"])
    expect(def!.clusters[1].versions.map((v) => v.short)).toEqual(["06"])
  })

  it("matches code names and definitions with the code name as detail", () => {
    const byName = searchMessages(repo, "SCOR")
    const codeHit = byName.find((h) => h.field === "code")
    expect(codeHit?.detail).toBe("SCOR")
    expect(codeHit?.xmlPath).toBe("/Document/Purp")

    const byDef = searchMessages(repo, "structured creditor")
    expect(byDef.some((h) => h.field === "code")).toBe(true)
  })

  it("matches constraint text with the constraint name as detail", () => {
    const hits = searchMessages(repo, "must be present")
    const con = hits.find((h) => h.field === "constraint")
    expect(con?.detail).toBe("Rule1")
    expect(con?.xmlPath).toBe("/Document/Purp")
  })

  it("prewarms the index in the background and reports readiness", async () => {
    // A fresh repo object starts unindexed; prewarm builds and caches it.
    const fresh: ERepository = {
      businessAreas: [
        {
          name: "Payments Clearing and Settlement",
          code: "pacs",
          definition: "",
          messages: [version("pacs.008.001.08", "Name of the debtor party")],
        },
      ],
    }
    expect(isMessageIndexReady(fresh)).toBe(false)
    await prewarmMessageIndex(fresh)
    expect(isMessageIndexReady(fresh)).toBe(true)
    expect(searchMessages(fresh, "debtor party")).toHaveLength(1)
  })
})
