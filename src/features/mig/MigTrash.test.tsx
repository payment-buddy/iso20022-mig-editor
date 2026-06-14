// @vitest-environment jsdom
import "fake-indexeddb/auto"
import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { deleteDatabase } from "@/core/storage/db"
import { loadMig, saveMig } from "@/core/storage/migStore"
import { loadTrash, trashMig } from "@/core/storage/trashStore"
import type { MessageImplementationGuide } from "@/core/types/types"
import { MigTrash } from "./MigTrash"

const mig = (name: string, version = "1.0"): MessageImplementationGuide => ({
  name,
  version,
  messageIdentifier: "pacs.008.001.08",
  elementOverrides: {},
})

/** Seed storage with trashed MIGs (deterministic deletedAt order). */
async function seedTrashed(...names: string[]) {
  let t = 1000
  for (const n of names) {
    await saveMig(mig(n))
    await trashMig(`${n}:1.0`, t++)
  }
}

const rowFor = (name: string) => screen.getByText(name).closest("tr") as HTMLTableRowElement

afterEach(async () => {
  cleanup()
  await deleteDatabase()
})

describe("MigTrash", () => {
  it("shows an empty state when the trash is empty", async () => {
    render(<MigTrash />)
    expect(await screen.findByText(/trash is empty/i)).toBeInTheDocument()
  })

  it("lists trashed MIGs", async () => {
    await seedTrashed("A", "B")
    render(<MigTrash />)
    expect(await screen.findByText("A")).toBeInTheDocument()
    expect(screen.getByText("B")).toBeInTheDocument()
  })

  it("restores a MIG back to the active store", async () => {
    await seedTrashed("A")
    render(<MigTrash />)
    await screen.findByText("A")

    await userEvent.click(within(rowFor("A")).getByRole("button", { name: /restore/i }))

    await waitFor(() => expect(screen.queryByText("A")).not.toBeInTheDocument())
    expect((await loadMig("A:1.0"))?.name).toBe("A")
    expect(await loadTrash()).toEqual([])
  })

  it("permanently deletes one MIG after confirming", async () => {
    await seedTrashed("A", "B")
    render(<MigTrash />)
    await screen.findByText("A")

    const purge = within(rowFor("A")).getByRole("button", { name: /delete a 1\.0 permanently/i })
    await userEvent.click(purge)
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(within(dialog).getByRole("button", { name: /delete permanently/i }))

    await waitFor(() => expect(screen.queryByText("A")).not.toBeInTheDocument())
    expect((await loadTrash()).map((t) => t.mig.name)).toEqual(["B"])
  })

  it("empties the whole trash after confirming", async () => {
    await seedTrashed("A", "B")
    render(<MigTrash />)
    await screen.findByText("A")

    await userEvent.click(screen.getByRole("button", { name: /empty trash/i }))
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(within(dialog).getByRole("button", { name: /delete permanently/i }))

    await waitFor(() => expect(screen.queryByText("A")).not.toBeInTheDocument())
    expect(await loadTrash()).toEqual([])
  })
})
