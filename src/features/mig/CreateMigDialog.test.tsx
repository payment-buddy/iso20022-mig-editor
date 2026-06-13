// @vitest-environment jsdom
import "fake-indexeddb/auto"
import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { deleteDatabase } from "@/core/storage/db"
import { loadAllMigs, saveMig } from "@/core/storage/migStore"
import { CreateMigDialog } from "./CreateMigDialog"

function renderDialog() {
  return render(
    <CreateMigDialog
      open
      onOpenChange={vi.fn()}
      messageIdentifier="pacs.008.001.08"
      shortCode="pacs.008"
    />,
  )
}

afterEach(async () => {
  cleanup()
  window.location.hash = ""
  await deleteDatabase()
})

describe("CreateMigDialog", () => {
  it("seeds the default name from the short code, plus version", () => {
    renderDialog()
    // Short code in the name, not the full identifier.
    expect(screen.getByLabelText("Name")).toHaveValue("MIG-pacs.008")
    expect(screen.getByLabelText("Version")).toHaveValue("1.0-DRAFT")
  })

  it("creates an empty MIG and navigates to its editor", async () => {
    renderDialog()
    await userEvent.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => expect(window.location.hash).toBe("#mig/MIG-pacs.008%3A1.0-DRAFT"))
    const migs = await loadAllMigs()
    expect(migs).toHaveLength(1)
    expect(migs[0]).toMatchObject({
      name: "MIG-pacs.008",
      version: "1.0-DRAFT",
      // The exact message version is still stored.
      messageIdentifier: "pacs.008.001.08",
      elementOverrides: {},
    })
  })

  it("requires a name and version", async () => {
    renderDialog()
    await userEvent.clear(screen.getByLabelText("Name"))
    await userEvent.click(screen.getByRole("button", { name: "Create" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(/required/i)
    expect(await loadAllMigs()).toHaveLength(0)
  })

  it("rejects a duplicate name:version", async () => {
    await saveMig({
      name: "MIG-pacs.008",
      version: "1.0-DRAFT",
      messageIdentifier: "pacs.008.001.08",
      elementOverrides: {},
    })
    renderDialog()
    await userEvent.click(screen.getByRole("button", { name: "Create" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(/already exists/i)
    expect(await loadAllMigs()).toHaveLength(1)
  })
})
