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
import type {
  ERepository,
  MessageElement,
  MessageImplementationGuide,
} from "@/core/types/types"
import { MigHistory } from "./MigHistory"

const emptyRepo: ERepository = { businessAreas: [] }

function el(xmlTag: string, elements: MessageElement[] = []): MessageElement {
  return {
    id: xmlTag,
    name: xmlTag,
    xmlTag,
    isAttribute: false,
    definition: "",
    minOccurs: 1,
    maxOccurs: 1,
    typeId: "",
    type: "",
    baseType: null,
    minInclusive: null,
    maxInclusive: null,
    totalDigits: null,
    fractionDigits: null,
    length: null,
    minLength: null,
    maxLength: null,
    pattern: null,
    baseValue: null,
    codes: [],
    constraints: [],
    examples: [],
    elements,
  }
}

/** A repo whose message lists its children in non-alphabetical schema order. */
const repoWith = (root: MessageElement): ERepository => ({
  businessAreas: [
    {
      name: "Payments",
      code: "pacs",
      definition: "",
      messages: [
        { name: "msg", identifier: "pacs.008.001.08", shortCode: "pacs.008", rootElement: root },
      ],
    },
  ],
})

const mig = (over: Partial<MessageImplementationGuide> = {}): MessageImplementationGuide => ({
  name: "EPC",
  version: "1.0",
  messageIdentifier: "pacs.008.001.08",
  elementOverrides: {},
  ...over,
})

const seedHistory = async () => {
  const base = mig()
  const edited = mig({ elementOverrides: { "/Doc/Amt": { maxLength: 20 } } })
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
    render(<MigHistory migKey="EPC:1.0" repo={emptyRepo} />)
    expect(await screen.findByText(/no revisions yet/i)).toBeInTheDocument()
  })

  it("diffs the selected revision against its predecessor", async () => {
    await seedHistory()
    render(<MigHistory migKey="EPC:1.0" repo={emptyRepo} />)

    // Newest revision selected by default → shows what it changed vs the baseline.
    expect(await screen.findByText("Amt")).toBeInTheDocument()
    expect(screen.getByText("Max length")).toBeInTheDocument()

    // The baseline (oldest) has nothing before it.
    await userEvent.click(screen.getByText("Initial"))
    expect(await screen.findByText(/initial snapshot/i)).toBeInTheDocument()
    expect(screen.queryByText("Max length")).not.toBeInTheDocument()
  })

  it("shows what a merge revision changed (vs the pre-merge baseline)", async () => {
    const base = mig()
    const merged = mig({ elementOverrides: { "/Doc/Amt": { maxLength: 12 } } })
    let revs = appendRevision([], base, 1000)
    revs = appendRevision(revs, merged, 2000, "Merged")
    await saveMig(merged)
    await saveRevisions("EPC:1.0", revs)
    render(<MigHistory migKey="EPC:1.0" repo={emptyRepo} />)

    // The newest ("Merged") revision is selected by default and shows its diff,
    // even though it equals the current MIG.
    expect(await screen.findByText("Merged")).toBeInTheDocument()
    expect(await screen.findByText("Amt")).toBeInTheDocument()
    expect(screen.getByText("Max length")).toBeInTheDocument()
  })

  it("reverts to a revision, restoring content, recording it, and routing back", async () => {
    await seedHistory()
    render(<MigHistory migKey="EPC:1.0" repo={emptyRepo} />)
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

  it("orders the diff by message schema order, not alphabetically", async () => {
    // Message lists Zeb before Amt; current sets both, baseline neither.
    const repo = repoWith(el("Doc", [el("Zeb"), el("Amt")]))
    const current = mig({ elementOverrides: { "/Doc/Amt": { maxLength: 5 }, "/Doc/Zeb": { maxLength: 7 } } })
    await saveMig(current)
    await saveRevisions("EPC:1.0", appendRevision(appendRevision([], mig(), 1000), current, 2000))
    render(<MigHistory migKey="EPC:1.0" repo={repo} />)

    // Newest revision selected by default → diff vs baseline lists both paths.
    const zeb = await screen.findByText("/Doc/Zeb")
    const amt = screen.getByText("/Doc/Amt")
    // Schema order → Zeb's card precedes Amt's (alphabetical would be the reverse).
    expect(zeb.compareDocumentPosition(amt) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
