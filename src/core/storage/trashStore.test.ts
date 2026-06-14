import "fake-indexeddb/auto"
import { afterEach, describe, expect, it } from "vitest"
import type { MessageImplementationGuide } from "@/core/types/types"
import { deleteDatabase } from "./db"
import { loadMig, saveMig } from "./migStore"
import { loadRevisions, saveRevisions } from "./revisionStore"
import {
  emptyTrash,
  loadTrash,
  loadTrashCount,
  purgeFromTrash,
  restoreFromTrash,
  trashMig,
} from "./trashStore"

const mig = (name: string, version = "1.0"): MessageImplementationGuide => ({
  name,
  version,
  messageIdentifier: "pacs.008.001.08",
  elementOverrides: {},
})

afterEach(async () => {
  await deleteDatabase()
})

describe("trashStore", () => {
  it("moves a MIG and its history into the trash, out of the active stores", async () => {
    await saveMig(mig("A"))
    await saveRevisions("A:1.0", [{ id: "r0", at: 1, mig: mig("A"), summary: "Initial" }])

    await trashMig("A:1.0", 1700)

    expect(await loadMig("A:1.0")).toBeNull()
    expect(await loadRevisions("A:1.0")).toEqual([])
    const trash = await loadTrash()
    expect(trash).toHaveLength(1)
    expect(trash[0]).toMatchObject({ deletedAt: 1700 })
    expect(trash[0].mig.name).toBe("A")
    expect(trash[0].revisions).toHaveLength(1)
    expect(await loadTrashCount()).toBe(1)
  })

  it("restores a trashed MIG with its history, removing it from the trash", async () => {
    await saveMig(mig("A"))
    await saveRevisions("A:1.0", [{ id: "r0", at: 1, mig: mig("A"), summary: "Initial" }])
    await trashMig("A:1.0", 1700)

    await restoreFromTrash("A:1.0")

    expect((await loadMig("A:1.0"))?.name).toBe("A")
    expect(await loadRevisions("A:1.0")).toHaveLength(1)
    expect(await loadTrash()).toEqual([])
  })

  it("purges one entry and empties all", async () => {
    await saveMig(mig("A"))
    await trashMig("A:1.0", 1)
    await saveMig(mig("B"))
    await trashMig("B:1.0", 2)

    await purgeFromTrash("A:1.0")
    expect((await loadTrash()).map((t) => t.mig.name)).toEqual(["B"])

    await emptyTrash()
    expect(await loadTrashCount()).toBe(0)
  })

  it("lists the newest deletion first", async () => {
    await saveMig(mig("A"))
    await trashMig("A:1.0", 100)
    await saveMig(mig("B"))
    await trashMig("B:1.0", 200)

    expect((await loadTrash()).map((t) => t.mig.name)).toEqual(["B", "A"])
  })
})
