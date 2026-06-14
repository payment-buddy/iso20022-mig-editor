// @vitest-environment jsdom
import "fake-indexeddb/auto"
import { afterEach, describe, expect, it } from "vitest"
import { renderHook } from "@testing-library/react"
import { appendRevision } from "@/core/mig/revisions"
import { deleteDatabase } from "@/core/storage/db"
import { loadRevisions, saveRevisions } from "@/core/storage/revisionStore"
import type { MessageImplementationGuide } from "@/core/types/types"
import { useRevisionSnapshots } from "./useRevisionSnapshots"

const mig = (
  over: Partial<MessageImplementationGuide> = {}
): MessageImplementationGuide => ({
  name: "EPC",
  version: "1.0",
  messageIdentifier: "pacs.008.001.08",
  elementOverrides: {},
  ...over,
})

/** Let the async history load (IndexedDB open + read) settle. */
const tick = async () => {
  for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0))
}

afterEach(async () => {
  await deleteDatabase()
})

describe("useRevisionSnapshots", () => {
  it("seeds the baseline, then snapshots an edit on flush", async () => {
    const { result, rerender } = renderHook(
      ({ m }) => useRevisionSnapshots("EPC:1.0", m),
      {
        initialProps: { m: mig() },
      }
    )
    await tick() // existing (empty) history loads
    rerender({ m: mig({ description: "x" }) }) // an edit
    await result.current() // flush the pending burst

    const revs = await loadRevisions("EPC:1.0")
    expect(revs.map((r) => r.summary)).toEqual(["Initial", "description"])
    expect(revs[0].mig.description).toBeUndefined() // baseline = as-loaded
    expect(revs[1].mig.description).toBe("x")
  })

  it("stores nothing for a view-only open (no edits)", async () => {
    const { result } = renderHook(
      ({ m }) => useRevisionSnapshots("EPC:1.0", m),
      {
        initialProps: { m: mig() },
      }
    )
    await tick()
    await result.current()
    expect(await loadRevisions("EPC:1.0")).toEqual([])
  })

  it("records nothing for a burst that nets no change (no empty revision)", async () => {
    const { result, rerender } = renderHook(
      ({ m }) => useRevisionSnapshots("EPC:1.0", m),
      {
        initialProps: { m: mig() },
      }
    )
    await tick()
    rerender({ m: mig({ description: "x" }) }) // an edit…
    rerender({ m: mig() }) // …reverted back to the baseline content
    await result.current()
    expect(await loadRevisions("EPC:1.0")).toEqual([]) // no baseline, no "No changes"
  })

  it("skips a no-op burst when history already exists", async () => {
    await saveRevisions(
      "EPC:1.0",
      appendRevision([], mig({ description: "y" }), 1)
    )
    const { result, rerender } = renderHook(
      ({ m }) => useRevisionSnapshots("EPC:1.0", m),
      {
        initialProps: { m: mig({ description: "y" }) },
      }
    )
    await tick()
    rerender({ m: mig({ description: "y", parentMIG: "B:1" }) }) // an edit…
    rerender({ m: mig({ description: "y" }) }) // …reverted to the last revision's content
    await result.current()
    expect(await loadRevisions("EPC:1.0")).toHaveLength(1) // unchanged — no new revision
  })

  it("appends to existing history without re-seeding a baseline", async () => {
    await saveRevisions("EPC:1.0", appendRevision([], mig(), 1))
    const { result, rerender } = renderHook(
      ({ m }) => useRevisionSnapshots("EPC:1.0", m),
      {
        initialProps: { m: mig() },
      }
    )
    await tick()
    rerender({ m: mig({ description: "y" }) })
    await result.current()

    const revs = await loadRevisions("EPC:1.0")
    expect(revs).toHaveLength(2) // the pre-existing one + the new edit
    expect(revs[1].summary).toBe("description")
  })
})
