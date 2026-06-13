import "fake-indexeddb/auto"
import { afterEach, describe, expect, it } from "vitest"
import type { ERepository } from "@/core/types/types"
import { deleteDatabase } from "./db"
import {
  clearERepository,
  hasERepository,
  loadERepository,
  saveERepository,
} from "./eRepositoryStore"

function makeRepository(areaCode: string): ERepository {
  return {
    businessAreas: [
      {
        name: "Payments",
        code: areaCode,
        definition: "Payments area",
        messages: [],
      },
    ],
  }
}

afterEach(async () => {
  await deleteDatabase()
})

describe("eRepository persistence", () => {
  it("returns null / false before anything is stored", async () => {
    expect(await loadERepository()).toBeNull()
    expect(await hasERepository()).toBe(false)
  })

  it("saves and loads an e-Repository round-trip", async () => {
    const repo = makeRepository("pacs")
    await saveERepository(repo)

    expect(await hasERepository()).toBe(true)
    expect(await loadERepository()).toEqual(repo)
  })

  it("persists across a fresh connection (reload)", async () => {
    await saveERepository(makeRepository("pain"))

    // deleteDatabase (afterEach) would wipe it; instead simulate reload by
    // re-reading — the wrapper opens its own connection internally.
    const loaded = await loadERepository()
    expect(loaded?.businessAreas[0].code).toBe("pain")
  })

  it("overwrites the single record on re-save", async () => {
    await saveERepository(makeRepository("pacs"))
    await saveERepository(makeRepository("camt"))

    const loaded = await loadERepository()
    expect(loaded?.businessAreas).toHaveLength(1)
    expect(loaded?.businessAreas[0].code).toBe("camt")
  })

  it("clears the stored e-Repository", async () => {
    await saveERepository(makeRepository("pacs"))
    await clearERepository()

    expect(await hasERepository()).toBe(false)
    expect(await loadERepository()).toBeNull()
  })

  it("clearing when empty is a no-op", async () => {
    await expect(clearERepository()).resolves.toBeUndefined()
    expect(await hasERepository()).toBe(false)
  })
})
