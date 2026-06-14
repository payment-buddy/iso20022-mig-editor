import { describe, expect, it } from "vitest"
import { parse, parseAllDocuments } from "yaml"
import type { MessageImplementationGuide } from "@/core/types/types"
import { buildMigDownload } from "./downloadMigs"

function mig(name: string, version: string): MessageImplementationGuide {
  return {
    name,
    version,
    messageIdentifier: "pacs.008.001.08",
    elementOverrides: {},
  }
}

describe("buildMigDownload", () => {
  it("returns null for an empty selection", () => {
    expect(buildMigDownload([])).toBeNull()
  })

  it("names a single MIG after itself and serializes the object", () => {
    const file = buildMigDownload([mig("EPC", "1.0")])!
    expect(file.filename).toBe("EPC-1.0.yaml")
    expect(parse(file.content)).toMatchObject({ name: "EPC", version: "1.0" })
  })

  it("combines many MIGs into one multi-document file", () => {
    const file = buildMigDownload([mig("A", "1"), mig("B", "1")])!
    expect(file.filename).toBe("MessageImplementationGuides.yaml")
    expect(file.content).toContain("\n---\n")
    const docs = parseAllDocuments(file.content).map((doc) => doc.toJS())
    expect(docs).toHaveLength(2)
    expect(docs.map((d) => d.name)).toEqual(["A", "B"])
  })
})
