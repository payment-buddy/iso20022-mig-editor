import { describe, expect, it } from "vitest"
import type { MessageImplementationGuide } from "@/core/types/types"
import { appendRevision, summarizeChange } from "./revisions"

const mig = (
  over: Partial<MessageImplementationGuide> = {}
): MessageImplementationGuide => ({
  name: "EPC",
  version: "1.0",
  messageIdentifier: "pacs.008.001.08",
  elementOverrides: {},
  ...over,
})

describe("summarizeChange", () => {
  it("reports no changes for identical MIGs", () => {
    expect(summarizeChange(mig(), mig())).toBe("No changes")
  })

  it("counts added / changed / removed override paths", () => {
    const prev = mig({
      elementOverrides: {
        "/Doc/A": { maxLength: 5 },
        "/Doc/B": { minOccurs: 1 },
      },
    })
    const next = mig({
      elementOverrides: {
        "/Doc/A": { maxLength: 9 },
        "/Doc/C": { minOccurs: 0 },
      },
    })
    // A changed, C added, B removed.
    expect(summarizeChange(prev, next)).toBe("1 changed, 1 added, 1 removed")
  })

  it("notes metadata touches", () => {
    expect(summarizeChange(mig(), mig({ description: "x" }))).toBe(
      "description"
    )
    expect(summarizeChange(mig(), mig({ parentMIG: "Base:1.0" }))).toBe(
      "parent"
    )
    expect(summarizeChange(mig(), mig({ version: "2.0" }))).toBe("renamed")
    expect(
      summarizeChange(mig(), mig({ elementAnnotationNames: ["Owner"] }))
    ).toBe("annotations")
  })

  it("combines metadata and override changes", () => {
    const next = mig({
      description: "x",
      elementOverrides: { "/Doc/A": { maxLength: 5 } },
    })
    expect(summarizeChange(mig(), next)).toBe("description; 1 added")
  })
})

describe("appendRevision", () => {
  it("labels the first revision Initial", () => {
    const out = appendRevision([], mig(), 1000)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: "1000-0", at: 1000, summary: "Initial" })
  })

  it("summarizes a later revision against its predecessor", () => {
    const r1 = appendRevision([], mig(), 1000)
    const r2 = appendRevision(r1, mig({ description: "x" }), 2000)
    expect(r2).toHaveLength(2)
    expect(r2[1]).toMatchObject({
      id: "2000-1",
      at: 2000,
      summary: "description",
    })
  })

  it("uses an explicit summary when given (e.g. a revert)", () => {
    const r1 = appendRevision([], mig(), 1000)
    const r2 = appendRevision(r1, mig({ description: "y" }), 2000, "Reverted")
    expect(r2[1].summary).toBe("Reverted")
  })

  it("does not mutate the input list", () => {
    const r1 = appendRevision([], mig(), 1000)
    appendRevision(r1, mig({ description: "x" }), 2000)
    expect(r1).toHaveLength(1)
  })
})
