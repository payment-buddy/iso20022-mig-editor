import "fake-indexeddb/auto"
import { afterEach, describe, expect, it } from "vitest"
import type { MessageImplementationGuide } from "@/core/types/types"
import { deleteDatabase } from "./db"
import { deleteMig, loadAllMigs, loadMig, saveMig } from "./migStore"

function makeMig(name: string, version: string): MessageImplementationGuide {
  return { name, messageIdentifier: "pacs.008.001.08", version, elementOverrides: {} }
}

afterEach(async () => {
  await deleteDatabase()
})

describe("MIG persistence", () => {
  it("returns an empty list / null before anything is stored", async () => {
    expect(await loadAllMigs()).toEqual([])
    expect(await loadMig("Nope:1")).toBeNull()
  })

  it("saves and loads MIGs keyed by name:version", async () => {
    await saveMig(makeMig("EPC", "1.0"))
    await saveMig(makeMig("CSM", "2.0"))

    const all = await loadAllMigs()
    expect(all).toHaveLength(2)
    expect(await loadMig("EPC:1.0")).toMatchObject({ name: "EPC", version: "1.0" })
  })

  it("replaces a MIG on re-save under the same key", async () => {
    await saveMig(makeMig("EPC", "1.0"))
    await saveMig({ ...makeMig("EPC", "1.0"), description: "updated" })

    expect(await loadAllMigs()).toHaveLength(1)
    expect(await loadMig("EPC:1.0")).toHaveProperty("description", "updated")
  })

  it("treats different versions of the same name as distinct records", async () => {
    await saveMig(makeMig("EPC", "1.0"))
    await saveMig(makeMig("EPC", "2.0"))
    expect(await loadAllMigs()).toHaveLength(2)
  })

  it("deletes a MIG by key", async () => {
    await saveMig(makeMig("EPC", "1.0"))
    await deleteMig("EPC:1.0")

    expect(await loadAllMigs()).toEqual([])
    expect(await loadMig("EPC:1.0")).toBeNull()
  })
})
