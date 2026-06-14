// @vitest-environment jsdom
import "fake-indexeddb/auto"
import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { deleteDatabase } from "@/core/storage/db"
import { loadAllMigs, loadMig, saveMig } from "@/core/storage/migStore"
import { saveRevisions } from "@/core/storage/revisionStore"
import { loadTrash } from "@/core/storage/trashStore"
import { formatLocalDateTime } from "@/lib/datetime"
import type { MessageImplementationGuide } from "@/core/types/types"
import { MigHome } from "./MigHome"
import { takePendingMerge } from "./pendingMerge"
import { downloadMigs } from "./downloadMigs"

// The download side-effect is exercised separately; here we assert the back-up
// affordance wires to it (and avoids jsdom's missing URL.createObjectURL).
vi.mock("./downloadMigs", () => ({ downloadMigs: vi.fn() }))

function migYaml(
  name: string,
  version: string,
  description?: string,
  messageIdentifier = "pacs.008.001.08",
): string {
  return (
    `name: ${name}\nversion: '${version}'\nmessageIdentifier: ${messageIdentifier}\n` +
    `elementOverrides: {}\n` +
    (description ? `description: ${description}\n` : "")
  )
}

function migFile(
  name: string,
  version: string,
  description?: string,
  messageIdentifier?: string,
): File {
  return new File([migYaml(name, version, description, messageIdentifier)], `${name}.yaml`, {
    type: "text/yaml",
  })
}

/** A single file holding an array of MIGs. */
function migArrayFile(entries: [string, string, string?][]): File {
  const yaml = entries
    .map((e) =>
      migYaml(...e)
        .split("\n")
        .filter(Boolean)
        .map((line, i) => (i === 0 ? `- ${line}` : `  ${line}`))
        .join("\n"),
    )
    .join("\n")
  return new File([yaml + "\n"], "batch.yaml", { type: "text/yaml" })
}

function migObj(
  name: string,
  version: string,
  messageIdentifier = "pacs.008.001.08",
): MessageImplementationGuide {
  return { name, version, messageIdentifier, elementOverrides: {} }
}

/** Seed storage, then mount and wait for the rows to load. */
async function renderWith(...migs: MessageImplementationGuide[]) {
  await Promise.all(migs.map(saveMig))
  render(<MigHome />)
  await screen.findByRole("grid")
}

function rowFor(name: string): HTMLTableRowElement {
  return screen.getByRole("link", { name }).closest("tr") as HTMLTableRowElement
}

afterEach(async () => {
  cleanup()
  window.location.hash = ""
  await deleteDatabase()
})

describe("MigHome", () => {
  it("shows an empty state before any MIG is uploaded", async () => {
    render(<MigHome />)
    expect(await screen.findByText(/no migs yet/i)).toBeInTheDocument()
  })

  it("uploads a single new MIG, persists it, and opens its editor", async () => {
    render(<MigHome />)
    await userEvent.upload(screen.getByLabelText("MIG YAML file"), migFile("EPC", "1.0"))

    // A single clean import lands straight in the editor.
    await waitFor(() => expect(window.location.hash).toBe("#mig/EPC%3A1.0"))
    expect(await loadMig("EPC:1.0")).not.toBeNull()
  })

  it("shows a Last modified time per MIG, dashing those with none", async () => {
    await saveRevisions("EPC:1.0", [
      { id: "r0", at: 1_700_000_000_000, mig: migObj("EPC", "1.0"), summary: "Initial" },
    ])
    await renderWith(migObj("EPC", "1.0"), migObj("CSM", "2.0"))

    // The timestamp is plain text (not a link); MIGs without history show a dash.
    expect(screen.getByText(formatLocalDateTime(1_700_000_000_000))).toBeInTheDocument()
    expect(screen.getByText("—")).toBeInTheDocument()
  })

  it("sorts rows by a column header, flipping direction on re-click", async () => {
    const user = userEvent.setup()
    await renderWith(migObj("Bravo", "1.0"), migObj("Alpha", "2.0"), migObj("Charlie", "1.5"))
    const names = () =>
      within(screen.getByRole("grid"))
        .getAllByRole("link")
        .map((l) => l.textContent)

    // Default: by name, ascending.
    expect(names()).toEqual(["Alpha", "Bravo", "Charlie"])

    // By Version ascending (1.0, 1.5, 2.0), then descending on re-click.
    await user.click(screen.getByRole("button", { name: /sort by version/i }))
    expect(names()).toEqual(["Bravo", "Charlie", "Alpha"])
    await user.click(screen.getByRole("button", { name: /sort by version/i }))
    expect(names()).toEqual(["Alpha", "Charlie", "Bravo"])
  })

  it("uploads an array of MIGs from one file", async () => {
    render(<MigHome />)
    const yaml =
      "- name: A\n  version: '1'\n  messageIdentifier: x\n  elementOverrides: {}\n" +
      "- name: B\n  version: '1'\n  messageIdentifier: x\n  elementOverrides: {}\n"
    await userEvent.upload(
      screen.getByLabelText("MIG YAML file"),
      new File([yaml], "both.yaml", { type: "text/yaml" }),
    )

    expect(await screen.findByRole("link", { name: "A" })).toBeInTheDocument()
    expect(await screen.findByRole("link", { name: "B" })).toBeInTheDocument()
  })

  it("rejects a malformed upload and surfaces a readable error", async () => {
    const user = userEvent.setup()
    render(<MigHome />)
    // Missing messageIdentifier → the schema rejects it.
    const bad = new File(["name: Oops\nversion: '1'\nelementOverrides: {}\n"], "bad.yaml", {
      type: "text/yaml",
    })
    await user.upload(screen.getByLabelText("MIG YAML file"), bad)

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(/couldn.t be imported/i)
    expect(alert).toHaveTextContent(/bad\.yaml.*messageIdentifier/i)
    expect(screen.queryByRole("link", { name: "Oops" })).not.toBeInTheDocument()

    // Dismissible.
    await user.click(within(alert).getByRole("button", { name: /dismiss import errors/i }))
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("prompts to resolve a duplicate import", async () => {
    await renderWith(migObj("EPC", "1.0"))
    await userEvent.upload(screen.getByLabelText("MIG YAML file"), migFile("EPC", "1.0"))

    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText(/already exists/i)).toBeInTheDocument()
    expect(within(dialog).getByText("EPC 1.0")).toBeInTheDocument()
  })

  it("Overwrite replaces the stored MIG with the incoming one", async () => {
    await renderWith(migObj("EPC", "1.0")) // no description
    await userEvent.upload(screen.getByLabelText("MIG YAML file"), migFile("EPC", "1.0", "updated"))

    await userEvent.click(await screen.findByRole("button", { name: /overwrite/i }))
    await waitFor(async () => expect((await loadMig("EPC:1.0"))?.description).toBe("updated"))
  })

  it("Skip keeps the stored duplicate and imports only the new ones", async () => {
    await renderWith(migObj("EPC", "1.0"))
    await userEvent.upload(
      screen.getByLabelText("MIG YAML file"),
      migArrayFile([
        ["EPC", "1.0", "updated"],
        ["NEW", "1.0"],
      ]),
    )

    await userEvent.click(await screen.findByRole("button", { name: /^skip$/i }))

    // The new one lands; the existing duplicate is untouched.
    expect(await screen.findByRole("link", { name: "NEW" })).toBeInTheDocument()
    await waitFor(async () => expect((await loadMig("EPC:1.0"))?.description).toBeUndefined())
  })

  it("Upload as new keeps the original and adds a version-bumped copy", async () => {
    await renderWith(migObj("EPC", "1.0"))
    await userEvent.upload(screen.getByLabelText("MIG YAML file"), migFile("EPC", "1.0", "updated"))

    await userEvent.click(await screen.findByRole("button", { name: /upload as new/i }))

    // Two EPC rows: the untouched original and the re-versioned import.
    await waitFor(() => expect(screen.getAllByRole("link", { name: "EPC" })).toHaveLength(2))
    expect((await loadMig("EPC:1.0"))?.description).toBeUndefined()
    const bumped = (await loadAllMigs()).find((m) => m.version.startsWith("1.0-"))
    expect(bumped?.description).toBe("updated")
  })

  it("Cancel aborts the import, changing nothing", async () => {
    await renderWith(migObj("EPC", "1.0"))
    await userEvent.upload(screen.getByLabelText("MIG YAML file"), migFile("EPC", "1.0", "updated"))

    await userEvent.click(await screen.findByRole("button", { name: /cancel/i }))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect((await loadMig("EPC:1.0"))?.description).toBeUndefined()
    expect((await loadAllMigs())).toHaveLength(1)
  })

  it("select-all toggles every row", async () => {
    await renderWith(migObj("A", "1"), migObj("B", "1"))
    await userEvent.click(screen.getByLabelText("Select all"))

    expect(screen.getByText("2 selected")).toBeInTheDocument()
    expect(rowFor("A")).toHaveAttribute("aria-selected", "true")
    expect(rowFor("B")).toHaveAttribute("aria-selected", "true")
  })

  it("Space toggles the focused row; Ctrl+A selects all", async () => {
    const user = userEvent.setup()
    await renderWith(migObj("A", "1"), migObj("B", "1"))

    rowFor("A").focus()
    await user.keyboard(" ")
    expect(rowFor("A")).toHaveAttribute("aria-selected", "true")
    expect(rowFor("B")).toHaveAttribute("aria-selected", "false")

    await user.keyboard("{Control>}a{/Control}")
    expect(screen.getByText("2 selected")).toBeInTheDocument()
  })

  it("Shift+ArrowDown extends a selection range", async () => {
    const user = userEvent.setup()
    await renderWith(migObj("A", "1"), migObj("B", "1"), migObj("C", "1"))

    rowFor("A").focus()
    await user.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}")
    expect(screen.getByText("3 selected")).toBeInTheDocument()
  })

  it("Enter on a row navigates to its editor route", async () => {
    const user = userEvent.setup()
    await renderWith(migObj("A", "1"))

    rowFor("A").focus()
    await user.keyboard("{Enter}")
    expect(window.location.hash).toBe("#mig/A%3A1")
  })

  it("Compare is enabled only with exactly two same-family MIGs selected", async () => {
    await renderWith(migObj("A", "1"), migObj("B", "1"), migObj("C", "1"))
    const compare = () => screen.getByRole("button", { name: /compare/i })

    expect(compare()).toBeDisabled()
    await userEvent.click(within(rowFor("A")).getByRole("checkbox"))
    expect(compare()).toBeDisabled()
    await userEvent.click(within(rowFor("B")).getByRole("checkbox"))
    expect(compare()).toBeEnabled() // A, B both pacs.008
    await userEvent.click(within(rowFor("C")).getByRole("checkbox"))
    expect(compare()).toBeDisabled() // three selected
  })

  it("Compare stays disabled for two MIGs of different message families", async () => {
    await renderWith(
      migObj("A", "1", "pacs.008.001.08"),
      migObj("B", "1", "pacs.009.001.08"),
    )
    const compare = () => screen.getByRole("button", { name: /compare/i })

    await userEvent.click(within(rowFor("A")).getByRole("checkbox"))
    await userEvent.click(within(rowFor("B")).getByRole("checkbox"))
    expect(screen.getByText("2 selected")).toBeInTheDocument()
    expect(compare()).toBeDisabled()
  })

  it("Compare is enabled for two versions of the same family", async () => {
    await renderWith(
      migObj("A", "1", "pacs.008.001.08"),
      migObj("B", "1", "pacs.008.001.09"),
    )
    const compare = () => screen.getByRole("button", { name: /compare/i })

    await userEvent.click(within(rowFor("A")).getByRole("checkbox"))
    await userEvent.click(within(rowFor("B")).getByRole("checkbox"))
    expect(compare()).toBeEnabled()
  })

  it("offers Merge for a single same-family duplicate and hands it to the merge screen", async () => {
    await renderWith(migObj("EPC", "1.0"))
    await userEvent.upload(screen.getByLabelText("MIG YAML file"), migFile("EPC", "1.0", "updated"))

    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(within(dialog).getByRole("button", { name: /merge/i }))

    // Routes to the merge screen and hands the parsed incoming over.
    expect(window.location.hash).toBe("#merge/EPC%3A1.0")
    expect(takePendingMerge("EPC:1.0")?.description).toBe("updated")
  })

  it("does not offer Merge when the duplicate is a different message family", async () => {
    await renderWith(migObj("EPC", "1.0", "pacs.008.001.08"))
    await userEvent.upload(
      screen.getByLabelText("MIG YAML file"),
      migFile("EPC", "1.0", "updated", "pacs.009.001.08"),
    )

    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).queryByRole("button", { name: /merge/i })).not.toBeInTheDocument()
  })

  it("does not offer Merge when several MIGs collide", async () => {
    await renderWith(migObj("A", "1"), migObj("B", "1"))
    await userEvent.upload(
      screen.getByLabelText("MIG YAML file"),
      migArrayFile([
        ["A", "1", "x"],
        ["B", "1", "y"],
      ]),
    )

    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).queryByRole("button", { name: /merge/i })).not.toBeInTheDocument()
  })

  it("backs up all stored MIGs from the local-only footer", async () => {
    vi.mocked(downloadMigs).mockClear()
    await renderWith(migObj("A", "1"), migObj("B", "1"))

    await userEvent.click(screen.getByRole("button", { name: /back up all/i }))

    expect(downloadMigs).toHaveBeenCalledTimes(1)
    expect(vi.mocked(downloadMigs).mock.calls[0][0]).toHaveLength(2)
  })

  it("moves the selection to the trash after confirming (and bumps the Trash count)", async () => {
    await renderWith(migObj("A", "1"), migObj("B", "1"))
    await userEvent.click(within(rowFor("A")).getByRole("checkbox"))
    await userEvent.click(screen.getByRole("button", { name: "Delete" }))

    const dialog = screen.getByRole("alertdialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }))

    // A leaves the list (B stays), and lands in the trash.
    await waitFor(() => expect(screen.queryByRole("link", { name: "A" })).not.toBeInTheDocument())
    expect(screen.getByRole("link", { name: "B" })).toBeInTheDocument()
    expect((await loadTrash()).map((t) => t.mig.name)).toEqual(["A"])
    // The header Trash link shows the count.
    expect(await screen.findByRole("link", { name: /trash \(1\)/i })).toBeInTheDocument()
  })
})
