// @vitest-environment jsdom
import "fake-indexeddb/auto"
import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { deleteDatabase } from "@/core/storage/db"
import { MigHome } from "./MigHome"

function migFile(name: string, version: string): File {
  const yaml = `name: ${name}\nversion: '${version}'\nmessageIdentifier: pacs.008.001.08\nelementOverrides: {}\n`
  return new File([yaml], `${name}.yaml`, { type: "text/yaml" })
}

afterEach(async () => {
  cleanup()
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

    expect(await screen.findByRole("link", { name: /A/ })).toBeInTheDocument()
    expect(await screen.findByRole("link", { name: /B/ })).toBeInTheDocument()
  })
})
