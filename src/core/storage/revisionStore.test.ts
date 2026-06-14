import "fake-indexeddb/auto"
import { afterEach, describe, expect, it } from "vitest"
import type { Revision } from "@/core/mig/revisions"
import type { MessageImplementationGuide } from "@/core/types/types"
import { deleteDatabase } from "./db"
import {
  deleteRevisions,
  loadLatestRevisionTimes,
  loadRevisions,
  renameRevisions,
  saveRevisions,
} from "./revisionStore"

const mig = (name: string, version: string): MessageImplementationGuide => ({
  name,
  version,
  messageIdentifier: "pacs.008.001.08",
  elementOverrides: {},
})

const rev = (id: string, m: MessageImplementationGuide): Revision => ({
  id,
  at: 1,
  mig: m,
  summary: "Initial",
})

afterEach(async () => {
  await deleteDatabase()
})

describe("revision persistence", () => {
  it("returns [] before anything is stored", async () => {
    expect(await loadRevisions("EPC:1.0")).toEqual([])
  })

  it("saves and loads a MIG's revision list", async () => {
    const revs = [rev("a", mig("EPC", "1.0"))]
    await saveRevisions("EPC:1.0", revs)
    expect(await loadRevisions("EPC:1.0")).toEqual(revs)
  })

  it("deletes a MIG's history", async () => {
    await saveRevisions("EPC:1.0", [rev("a", mig("EPC", "1.0"))])
    await deleteRevisions("EPC:1.0")
    expect(await loadRevisions("EPC:1.0")).toEqual([])
  })

  it("moves history to a new key on rename, clearing the old one", async () => {
    const revs = [rev("a", mig("EPC", "1.0"))]
    await saveRevisions("EPC:1.0", revs)
    await renameRevisions("EPC:1.0", "EPC:2.0")
    expect(await loadRevisions("EPC:1.0")).toEqual([])
    expect(await loadRevisions("EPC:2.0")).toEqual(revs)
  })

  it("rename is a no-op when there's no history or the key is unchanged", async () => {
    await renameRevisions("Empty:1.0", "Empty:2.0")
    expect(await loadRevisions("Empty:2.0")).toEqual([])

    await saveRevisions("EPC:1.0", [rev("a", mig("EPC", "1.0"))])
    await renameRevisions("EPC:1.0", "EPC:1.0")
    expect(await loadRevisions("EPC:1.0")).toHaveLength(1)
  })

  it("reports the latest revision time per MIG", async () => {
    await saveRevisions("A:1", [
      { ...rev("a0", mig("A", "1")), at: 100 },
      { ...rev("a1", mig("A", "1")), at: 200 },
    ])
    await saveRevisions("B:1", [{ ...rev("b0", mig("B", "1")), at: 50 }])
    expect(await loadLatestRevisionTimes()).toEqual({ "A:1": 200, "B:1": 50 })
  })
})
