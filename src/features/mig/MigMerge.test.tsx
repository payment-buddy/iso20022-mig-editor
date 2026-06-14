// @vitest-environment jsdom
import "fake-indexeddb/auto"
import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { deleteDatabase } from "@/core/storage/db"
import { loadMig, saveMig } from "@/core/storage/migStore"
import { loadRevisions } from "@/core/storage/revisionStore"
import { getMigKey } from "@/core/mig/migKey"
import { serializeMig } from "@/core/mig/serializeMig"
import type {
  ERepository,
  MessageDefinition,
  MessageElement,
  MessageImplementationGuide,
} from "@/core/types/types"
import { MigMerge } from "./MigMerge"
import { setPendingMerge } from "./pendingMerge"

function mig(
  name: string,
  overrides: MessageImplementationGuide["elementOverrides"],
  messageIdentifier = "pacs.008.001.08",
): MessageImplementationGuide {
  return { name, version: "1.0", messageIdentifier, elementOverrides: overrides }
}

function migFile(m: MessageImplementationGuide): File {
  return new File([serializeMig(m)], `${m.name}.yaml`, { type: "text/yaml" })
}

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

function repoWith(root: MessageElement): ERepository {
  const def: MessageDefinition = {
    name: "FIToFICstmrCdtTrf",
    identifier: "pacs.008.001.08",
    shortCode: "pacs.008",
    rootElement: root,
  }
  return { businessAreas: [{ name: "Payments", code: "pacs", definition: "", messages: [def] }] }
}

const docAmt = repoWith(el("Doc", [el("Amt")]))

async function renderMerge(target: MessageImplementationGuide, repo: ERepository = docAmt) {
  await saveMig(target)
  render(<MigMerge targetKey={getMigKey(target)} repo={repo} />)
}

afterEach(async () => {
  cleanup()
  window.location.hash = ""
  await deleteDatabase()
})

describe("MigMerge", () => {
  it("prompts for an upload, then shows the field diff", async () => {
    await renderMerge(mig("Target", { "/Doc/Amt": { maxLength: 18 } }))
    await screen.findByRole("button", { name: /upload mig to merge/i })

    await userEvent.upload(
      screen.getByLabelText("MIG to merge"),
      migFile(mig("Incoming", { "/Doc/Amt": { maxLength: 12 } })),
    )

    const card = await screen.findByRole("region", { name: /Amt/i })
    expect(within(card).getByText("18")).toBeInTheDocument()
    expect(within(card).getByText("12")).toBeInTheDocument()
  })

  it("takes an incoming field into the draft and Save persists it", async () => {
    await renderMerge(mig("Target", { "/Doc/Amt": { maxLength: 18 } }))
    await screen.findByRole("button", { name: /upload mig to merge/i })
    await userEvent.upload(
      screen.getByLabelText("MIG to merge"),
      migFile(mig("Incoming", { "/Doc/Amt": { maxLength: 12 } })),
    )

    const card = await screen.findByRole("region", { name: /Amt/i })
    expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled() // not dirty yet

    await userEvent.click(within(card).getByRole("button", { name: /take incoming max length/i }))
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }))

    await waitFor(async () =>
      expect((await loadMig("Target:1.0"))?.elementOverrides["/Doc/Amt"].maxLength).toBe(12),
    )
    expect(window.location.hash).toBe("#mig/Target%3A1.0")
    // The merge is recorded in history: the pre-merge baseline + a "Merged" rev.
    const revs = await loadRevisions("Target:1.0")
    expect(revs.map((r) => r.summary)).toEqual(["Initial", "Merged"])
    expect(revs[1].mig.elementOverrides["/Doc/Amt"].maxLength).toBe(12)
  })

  it("consumes an incoming MIG handed off from the import flow (no upload)", async () => {
    const target = mig("Target", { "/Doc/Amt": { maxLength: 18 } })
    setPendingMerge(getMigKey(target), mig("Incoming", { "/Doc/Amt": { maxLength: 12 } }))
    await renderMerge(target)

    // Diff shown straight away, without the upload step.
    const card = await screen.findByRole("region", { name: /Amt/i })
    expect(within(card).getByText("12")).toBeInTheDocument()
  })

  it("rejects an incoming MIG from a different message family", async () => {
    await renderMerge(mig("Target", { "/Doc/Amt": { maxLength: 18 } }, "pacs.008.001.08"))
    await screen.findByRole("button", { name: /upload mig to merge/i })

    await userEvent.upload(
      screen.getByLabelText("MIG to merge"),
      migFile(mig("Other", { "/Doc/Amt": { maxLength: 12 } }, "pacs.009.001.08")),
    )

    expect(await screen.findByRole("alert")).toHaveTextContent(/different message family/i)
    expect(screen.queryByRole("region", { name: /Amt/i })).not.toBeInTheDocument()
  })

  it("disables taking a field absent from the target's message version", async () => {
    await renderMerge(mig("Target", { "/Doc/Amt": { maxLength: 18 } }))
    await screen.findByRole("button", { name: /upload mig to merge/i })

    await userEvent.upload(
      screen.getByLabelText("MIG to merge"),
      migFile(mig("Incoming", { "/Doc/Amt": { maxLength: 18 }, "/Doc/Extra": { maxLength: 5 } })),
    )

    const card = await screen.findByRole("region", { name: /Extra/i })
    expect(within(card).getByRole("button")).toBeDisabled()
  })

  it("reports no differences when the upload matches the target", async () => {
    await renderMerge(mig("Target", { "/Doc/Amt": { maxLength: 18 } }))
    await screen.findByRole("button", { name: /upload mig to merge/i })

    await userEvent.upload(
      screen.getByLabelText("MIG to merge"),
      migFile(mig("Same", { "/Doc/Amt": { maxLength: 18 } })),
    )

    expect(await screen.findByText(/no differences/i)).toBeInTheDocument()
  })
})
