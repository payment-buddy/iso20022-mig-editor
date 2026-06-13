// @vitest-environment jsdom
import "fake-indexeddb/auto"
import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
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

  it("copies a field from A to B, persists it, and resolves the difference", async () => {
    const a = mig("A", { "Doc/Amt": { maxLength: 18 } })
    const b = mig("B", { "Doc/Amt": { maxLength: 12 } })
    await renderCompare(a, b)

    const card = await screen.findByRole("region", { name: /Amt — changed/i })
    await userEvent.click(within(card).getByRole("button", { name: /Copy Max length to B 1\.0/i }))

    // The two MIGs now agree on that field → nothing left to compare.
    expect(await screen.findByText(/identical overrides/i)).toBeInTheDocument()
    const storedB = await loadMig(getMigKey(b))
    expect(storedB?.elementOverrides["Doc/Amt"].maxLength).toBe(18)
  })

  it("copies a field from B to A in the other direction", async () => {
    const a = mig("A", { "Doc/Amt": { maxLength: 18 } })
    const b = mig("B", { "Doc/Amt": { maxLength: 12 } })
    await renderCompare(a, b)

    const card = await screen.findByRole("region", { name: /Amt — changed/i })
    await userEvent.click(within(card).getByRole("button", { name: /Copy Max length to A 1\.0/i }))

    expect(await screen.findByText(/identical overrides/i)).toBeInTheDocument()
    const storedA = await loadMig(getMigKey(a))
    expect(storedA?.elementOverrides["Doc/Amt"].maxLength).toBe(12)
  })

  it("reports a missing MIG", async () => {
    render(<MigCompare keyA="Ghost:1.0" keyB="AlsoGhost:1.0" repo={emptyRepo} />)
    expect(await screen.findByText(/MIG not found/i)).toBeInTheDocument()
  })
})
