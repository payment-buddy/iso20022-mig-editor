// @vitest-environment jsdom
import "fake-indexeddb/auto"
import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { deleteDatabase } from "@/core/storage/db"
import { loadMig, saveMig } from "@/core/storage/migStore"
import { getMigKey } from "@/core/mig/migKey"
import type { ERepository, MessageImplementationGuide } from "@/core/types/types"
import { MigCompare } from "./MigCompare"

const emptyRepo: ERepository = { businessAreas: [] }

function mig(
  name: string,
  overrides: MessageImplementationGuide["elementOverrides"],
  messageIdentifier = "pacs.008.001.08",
): MessageImplementationGuide {
  return { name, version: "1.0", messageIdentifier, elementOverrides: overrides }
}

async function renderCompare(a: MessageImplementationGuide, b: MessageImplementationGuide) {
  await saveMig(a)
  await saveMig(b)
  render(<MigCompare keyA={getMigKey(a)} keyB={getMigKey(b)} repo={emptyRepo} />)
}

afterEach(async () => {
  cleanup()
  window.location.hash = ""
  await deleteDatabase()
})

describe("MigCompare", () => {
  it("reports identical MIGs with nothing to compare", async () => {
    const a = mig("A", { "Doc/Amt": { maxLength: 18 } })
    const b = mig("B", { "Doc/Amt": { maxLength: 18 } })
    await renderCompare(a, b)
    expect(await screen.findByText(/identical overrides/i)).toBeInTheDocument()
  })

  it("shows a changed element with both column values", async () => {
    const a = mig("A", { "Doc/Amt": { maxLength: 18 } })
    const b = mig("B", { "Doc/Amt": { maxLength: 12 } })
    await renderCompare(a, b)

    expect(await screen.findByText(/1 element differs/i)).toBeInTheDocument()
    const card = screen.getByRole("region", { name: /Amt — changed/i })
    expect(card).toBeInTheDocument()
    expect(within(card).getByText("18")).toBeInTheDocument()
    expect(within(card).getByText("12")).toBeInTheDocument()
  })

  it("marks a field absent in one MIG as inherited", async () => {
    const a = mig("A", { "Doc/Amt": { maxLength: 18 } })
    const b = mig("B", { "Doc/Amt": { maxLength: 18, minLength: 1 } })
    await renderCompare(a, b)

    const card = await screen.findByRole("region", { name: /Amt — changed/i })
    expect(within(card).getByText(/inherits/i)).toBeInTheDocument()
    expect(within(card).getByText("1")).toBeInTheDocument()
  })

  it("warns when the two MIGs target different messages", async () => {
    const a = mig("A", { "Doc/Amt": { maxLength: 18 } }, "pacs.008.001.08")
    const b = mig("B", { "Doc/Amt": { maxLength: 12 } }, "pacs.009.001.08")
    await renderCompare(a, b)
    expect(await screen.findByText(/target different messages/i)).toBeInTheDocument()
  })

  it("copies a field from A to B and resolves the difference in the draft", async () => {
    const a = mig("A", { "Doc/Amt": { maxLength: 18 } })
    const b = mig("B", { "Doc/Amt": { maxLength: 12 } })
    await renderCompare(a, b)

    const card = await screen.findByRole("region", { name: /Amt — changed/i })
    await userEvent.click(within(card).getByRole("button", { name: /Copy Max length to B 1\.0/i }))

    // The draft now agrees on that field → nothing left to compare.
    expect(await screen.findByText(/identical overrides/i)).toBeInTheDocument()
  })

  it("does not persist a copy until Save is clicked", async () => {
    const a = mig("A", { "Doc/Amt": { maxLength: 18 } })
    const b = mig("B", { "Doc/Amt": { maxLength: 12 } })
    await renderCompare(a, b)

    const card = await screen.findByRole("region", { name: /Amt — changed/i })
    await userEvent.click(within(card).getByRole("button", { name: /Copy Max length to B 1\.0/i }))

    // Still in the draft only — storage is unchanged, and the UI flags it.
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
    expect((await loadMig(getMigKey(b)))?.elementOverrides["Doc/Amt"].maxLength).toBe(12)

    await userEvent.click(screen.getByRole("button", { name: /^save$/i }))

    await waitFor(async () =>
      expect((await loadMig(getMigKey(b)))?.elementOverrides["Doc/Amt"].maxLength).toBe(18),
    )
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument()
  })

  it("persists a B→A copy on Save", async () => {
    const a = mig("A", { "Doc/Amt": { maxLength: 18 } })
    const b = mig("B", { "Doc/Amt": { maxLength: 12 } })
    await renderCompare(a, b)

    const card = await screen.findByRole("region", { name: /Amt — changed/i })
    await userEvent.click(within(card).getByRole("button", { name: /Copy Max length to A 1\.0/i }))
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }))

    await waitFor(async () =>
      expect((await loadMig(getMigKey(a)))?.elementOverrides["Doc/Amt"].maxLength).toBe(12),
    )
  })

  it("disables Save until there are edits and reverts them with Discard", async () => {
    const a = mig("A", { "Doc/Amt": { maxLength: 18 } })
    const b = mig("B", { "Doc/Amt": { maxLength: 12 } })
    await renderCompare(a, b)

    expect(await screen.findByRole("button", { name: /^save$/i })).toBeDisabled()

    const card = await screen.findByRole("region", { name: /Amt — changed/i })
    await userEvent.click(within(card).getByRole("button", { name: /Copy Max length to B 1\.0/i }))
    expect(screen.getByRole("button", { name: /^save$/i })).toBeEnabled()

    await userEvent.click(screen.getByRole("button", { name: /discard/i }))

    // Back to the original difference, Save disabled, storage untouched.
    expect(await screen.findByRole("region", { name: /Amt — changed/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled()
    expect((await loadMig(getMigKey(b)))?.elementOverrides["Doc/Amt"].maxLength).toBe(12)
  })

  it("guards the Back link when there are unsaved changes", async () => {
    window.location.hash = "compare/A%3A1.0/B%3A1.0"
    const a = mig("A", { "Doc/Amt": { maxLength: 18 } })
    const b = mig("B", { "Doc/Amt": { maxLength: 12 } })
    await renderCompare(a, b)

    const card = await screen.findByRole("region", { name: /Amt — changed/i })
    await userEvent.click(within(card).getByRole("button", { name: /Copy Max length to B 1\.0/i }))

    await userEvent.click(screen.getByRole("link", { name: /back/i }))

    // Confirm dialog appears and navigation is blocked (still on the compare hash).
    expect(await screen.findByText(/discard unsaved changes/i)).toBeInTheDocument()
    expect(window.location.hash).toBe("#compare/A%3A1.0/B%3A1.0")

    await userEvent.click(screen.getByRole("button", { name: /discard & leave/i }))
    expect(window.location.hash).not.toContain("compare")
  })

  it("lets the Back link through when there are no unsaved changes", async () => {
    const a = mig("A", { "Doc/Amt": { maxLength: 18 } })
    const b = mig("B", { "Doc/Amt": { maxLength: 12 } })
    await renderCompare(a, b)

    await screen.findByRole("region", { name: /Amt — changed/i })
    await userEvent.click(screen.getByRole("link", { name: /back/i }))
    expect(screen.queryByText(/discard unsaved changes/i)).not.toBeInTheDocument()
  })

  it("reports a missing MIG", async () => {
    render(<MigCompare keyA="Ghost:1.0" keyB="AlsoGhost:1.0" repo={emptyRepo} />)
    expect(await screen.findByText(/MIG not found/i)).toBeInTheDocument()
  })
})
