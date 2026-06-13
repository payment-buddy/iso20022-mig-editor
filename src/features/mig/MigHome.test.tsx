// @vitest-environment jsdom
import "fake-indexeddb/auto"
import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { deleteDatabase } from "@/core/storage/db"
import { saveMig } from "@/core/storage/migStore"
import type { MessageImplementationGuide } from "@/core/types/types"
import { MigHome } from "./MigHome"

function migFile(name: string, version: string): File {
  const yaml = `name: ${name}\nversion: '${version}'\nmessageIdentifier: pacs.008.001.08\nelementOverrides: {}\n`
  return new File([yaml], `${name}.yaml`, { type: "text/yaml" })
}

function migObj(name: string, version: string): MessageImplementationGuide {
  return { name, version, messageIdentifier: "pacs.008.001.08", elementOverrides: {} }
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

  it("uploads a MIG YAML, persists it, and lists it", async () => {
    render(<MigHome />)
    await userEvent.upload(screen.getByLabelText("MIG YAML file"), migFile("EPC", "1.0"))

    const link = await screen.findByRole("link", { name: /EPC/ })
    expect(link).toHaveAttribute("href", "#mig/EPC%3A1.0")
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

  it("Compare is enabled only with exactly two selected", async () => {
    await renderWith(migObj("A", "1"), migObj("B", "1"), migObj("C", "1"))
    const compare = () => screen.getByRole("button", { name: /compare/i })

    expect(compare()).toBeDisabled()
    await userEvent.click(within(rowFor("A")).getByRole("checkbox"))
    expect(compare()).toBeDisabled()
    await userEvent.click(within(rowFor("B")).getByRole("checkbox"))
    expect(compare()).toBeEnabled()
  })

  it("deletes the selection after confirming", async () => {
    await renderWith(migObj("A", "1"), migObj("B", "1"))
    await userEvent.click(within(rowFor("A")).getByRole("checkbox"))
    await userEvent.click(screen.getByRole("button", { name: "Delete" }))

    const dialog = screen.getByRole("alertdialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }))

    await waitFor(() => expect(screen.queryByRole("link", { name: "A" })).not.toBeInTheDocument())
    expect(screen.getByRole("link", { name: "B" })).toBeInTheDocument()
  })
})
