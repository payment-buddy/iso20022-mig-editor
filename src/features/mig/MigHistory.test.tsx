// @vitest-environment jsdom
import "fake-indexeddb/auto"
import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { deleteDatabase } from "@/core/storage/db"
import { loadMig, saveMig } from "@/core/storage/migStore"
import { loadRevisions, saveRevisions } from "@/core/storage/revisionStore"
import { appendRevision } from "@/core/mig/revisions"
import type { MessageImplementationGuide } from "@/core/types/types"
import { MigHistory } from "./MigHistory"

const mig = (over: Partial<MessageImplementationGuide> = {}): MessageImplementationGuide => ({
  name: "EPC",
  version: "1.0",
  messageIdentifier: "pacs.008.001.08",
  elementOverrides: {},
  ...over,
})

const seedHistory = async () => {
  const base = mig()
  const edited = mig({ elementOverrides: { "Doc/Amt": { maxLength: 20 } } })
  let revs = appendRevision([], base, 1000)
  revs = appendRevision(revs, edited, 2000)
  await saveMig(edited)
  await saveRevisions("EPC:1.0", revs)
}

afterEach(async () => {
  cleanup()
  await deleteDatabase()
  window.location.hash = ""
})

describe("MigHistory", () => {
  it("shows a placeholder when there are no revisions", async () => {
    await saveMig(mig())
    render(<MigHistory migKey="EPC:1.0" />)
    expect(await screen.findByText(/no revisions yet/i)).toBeInTheDocument()
  })

  it("diffs the selected revision against the current MIG", async () => {
    await seedHistory()
    render(<MigHistory migKey="EPC:1.0" />)

    // Newest revision selected by default == current → no differences.
    expect(await screen.findByText(/no differences/i)).toBeInTheDocument()

    // Select the baseline → the diff shows the added Doc/Amt override.
    await userEvent.click(screen.getByText("Initial"))
    expect(await screen.findByText("Amt")).toBeInTheDocument()
    expect(screen.getByText("Max length")).toBeInTheDocument()
  })

  it("reverts to a revision, restoring content, recording it, and routing back", async () => {
    await seedHistory()
    render(<MigHistory migKey="EPC:1.0" />)
    await screen.findByText("Initial")

    const baselineRow = screen.getByText("Initial").closest("li")!
    await userEvent.click(within(baselineRow).getByRole("button", { name: /revert/i }))
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Revert" }))

    await waitFor(async () => {
      // Restored to the baseline (no overrides).
      expect((await loadMig("EPC:1.0"))?.elementOverrides).toEqual({})
    })
    const revs = await loadRevisions("EPC:1.0")
    expect(revs[revs.length - 1].summary).toBe("Reverted")
    expect(window.location.hash).toBe("#mig/EPC%3A1.0")
  })
})
