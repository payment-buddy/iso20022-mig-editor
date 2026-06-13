import { describe, expect, it } from "vitest"
import type { MessageImplementationGuide } from "@/core/types/types"
import { duplicateKeysOf, migsForResolution } from "./importDuplicates"

function mig(name: string, version: string, description?: string): MessageImplementationGuide {
  return {
    name,
    version,
    messageIdentifier: "pacs.008.001.08",
    elementOverrides: {},
    ...(description ? { description } : {}),
  }
}

describe("duplicateKeysOf", () => {
  it("returns the incoming keys that already exist", () => {
    const incoming = [mig("A", "1"), mig("B", "1"), mig("C", "2")]
    const dups = duplicateKeysOf(incoming, ["A:1", "C:2", "Z:9"])
    expect(dups).toEqual(new Set(["A:1", "C:2"]))
  })

  it("is empty when nothing collides", () => {
    expect(duplicateKeysOf([mig("A", "1")], ["B:1"]).size).toBe(0)
  })
})

describe("migsForResolution", () => {
  const incoming = [mig("A", "1", "incoming"), mig("B", "1", "new")]
  const dups = new Set(["A:1"])

  it("overwrite keeps every incoming MIG as-is", () => {
    expect(migsForResolution(incoming, dups, "overwrite", 999)).toEqual(incoming)
  })

  it("skip drops the duplicates, keeps the new ones", () => {
    const out = migsForResolution(incoming, dups, "skip", 999)
    expect(out.map((m) => `${m.name}:${m.version}`)).toEqual(["B:1"])
  })

  it("new re-versions duplicates with the timestamp, leaves others", () => {
    const out = migsForResolution(incoming, dups, "new", 1700000000000)
    expect(out.map((m) => `${m.name}:${m.version}`)).toEqual(["A:1-1700000000000", "B:1"])
    // The bumped duplicate keeps its content (a fresh identity, not a mutation).
    expect(out[0].description).toBe("incoming")
  })

  it("does not mutate the incoming MIGs", () => {
    migsForResolution(incoming, dups, "new", 1)
    expect(incoming[0].version).toBe("1")
  })
})
