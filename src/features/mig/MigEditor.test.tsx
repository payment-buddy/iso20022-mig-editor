// @vitest-environment jsdom
import "fake-indexeddb/auto"
import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { deleteDatabase } from "@/core/storage/db"
import { loadMig, saveMig } from "@/core/storage/migStore"
import { getMigKey } from "@/core/mig/migKey"
import type {
  ERepository,
  MessageElement,
  MessageImplementationGuide,
} from "@/core/types/types"
import { MigEditor } from "./MigEditor"

function el(name: string, props: Partial<MessageElement> = {}): MessageElement {
  return {
    id: name,
    name,
    xmlTag: `${name}Tag`,
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
    elements: [],
    ...props,
  }
}

const REPO: ERepository = {
  businessAreas: [
    {
      name: "Payments Clearing",
      code: "pacs",
      definition: "",
      messages: [
        {
          name: "CreditTransferV10",
          identifier: "pacs.008.001.10",
          shortCode: "pacs.008",
          rootElement: el("Document", {
            elements: [el("GrpHdr"), el("CdtTrfTxInf", { elements: [el("Amt")] })],
          }),
        },
      ],
    },
  ],
}

const MIG: MessageImplementationGuide = {
  name: "EPC Guide",
  version: "1.0",
  messageIdentifier: "pacs.008.001.10",
  elementOverrides: {},
}

afterEach(async () => {
  cleanup()
  window.location.hash = ""
  await deleteDatabase()
})

describe("MigEditor", () => {
  it("renders the header and element tree for a stored MIG", async () => {
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)

    // Tree appears once the MIG loads from IndexedDB.
    expect(await screen.findByRole("treeitem", { name: "Document" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "EPC Guide" })).toBeInTheDocument()
    // Root is expanded by default.
    expect(screen.getByRole("treeitem", { name: "GrpHdr" })).toBeInTheDocument()
    // Grandchild stays collapsed until its parent is expanded.
    expect(screen.queryByRole("treeitem", { name: "Amt" })).not.toBeInTheDocument()
  })

  it("shows the focused element's read-only fields in the detail panel", async () => {
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)

    await screen.findByRole("treeitem", { name: "Document" })
    // Root is selected by default (selection follows focus).
    const panel = screen.getByRole("region", { name: /element details/i })
    expect(within(panel).getByText("Document")).toBeInTheDocument()
    expect(within(panel).getByRole("button", { name: "Edit Definition" })).toBeInTheDocument()
  })

  it("edits, autosaves and resets an element's definition override", async () => {
    const user = userEvent.setup()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })
    const panel = screen.getByRole("region", { name: /element details/i })

    // Edit the root element's definition.
    await user.click(within(panel).getByRole("button", { name: "Edit Definition" }))
    await user.type(within(panel).getByRole("textbox", { name: "Definition" }), "House rule")
    await user.tab() // blur commits

    // Persisted as a tri-state override keyed by xmlPath, and flagged overridden.
    expect((await loadMig(getMigKey(MIG)))?.elementOverrides["DocumentTag"]?.definition).toBe(
      "House rule",
    )
    expect(within(panel).getByText(/overridden/i)).toBeInTheDocument()

    // Reset removes the override entirely.
    await user.click(within(panel).getByRole("button", { name: /reset to inherited/i }))
    expect((await loadMig(getMigKey(MIG)))?.elementOverrides["DocumentTag"]).toBeUndefined()
    expect(within(panel).queryByText(/overridden/i)).not.toBeInTheDocument()
  })

  it("shows a not-found state when the MIG is absent", async () => {
    render(<MigEditor migKey="Ghost:9.9" repo={REPO} />)
    expect(await screen.findByRole("heading", { name: /mig not found/i })).toBeInTheDocument()
  })

  it("edits and autosaves the description inline", async () => {
    const user = userEvent.setup()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    await user.click(screen.getByRole("button", { name: "Edit Description" }))
    await user.type(screen.getByRole("textbox", { name: "Description" }), "Domestic credit transfers")
    await user.tab() // blur commits

    // Reflected in the UI and persisted to storage.
    expect(screen.getByText("Domestic credit transfers")).toBeInTheDocument()
    const saved = await loadMig(getMigKey(MIG))
    expect(saved?.description).toBe("Domestic credit transfers")
  })

  it("edits Min/Max occurs overrides (unbounded = null)", async () => {
    const user = userEvent.setup()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })
    const panel = screen.getByRole("region", { name: /element details/i })

    // Min occurs: baseline 1 → 0.
    await user.click(within(panel).getByRole("button", { name: "Edit Min occurs" }))
    const minInput = within(panel).getByRole("spinbutton", { name: "Min occurs" })
    await user.clear(minInput)
    await user.type(minInput, "0")
    await user.tab()
    expect((await loadMig(getMigKey(MIG)))?.elementOverrides["DocumentTag"]?.minOccurs).toBe(0)

    // Max occurs: baseline 1 → unbounded (empty number field, stored as null).
    await user.click(within(panel).getByRole("button", { name: "Edit Max occurs" }))
    const maxInput = within(panel).getByRole("spinbutton", { name: "Max occurs" })
    await user.clear(maxInput)
    await user.tab()
    const saved = await loadMig(getMigKey(MIG))
    const override = saved?.elementOverrides["DocumentTag"]
    expect(override && "maxOccurs" in override).toBe(true)
    expect(override?.maxOccurs).toBeNull()

    // Both fields are now overridden → two reset actions; the first resets Min occurs.
    const resets = within(panel).getAllByRole("button", { name: /reset to inherited/i })
    await user.click(resets[0])
    expect((await loadMig(getMigKey(MIG)))?.elementOverrides["DocumentTag"]?.minOccurs).toBeUndefined()
  })

  it("offers same-message MIGs as parents and autosaves the choice", async () => {
    const user = userEvent.setup()
    const base: MessageImplementationGuide = { ...MIG, name: "Base", description: undefined }
    await saveMig(base)
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    await user.selectOptions(screen.getByRole("combobox", { name: "Parent MIG" }), "Base:1.0")

    const saved = await loadMig(getMigKey(MIG))
    expect(saved?.parentMIG).toBe("Base:1.0")
  })

  it("warns when the parent MIG isn't loaded", async () => {
    const child: MessageImplementationGuide = { ...MIG, name: "Child", parentMIG: "Ghost:1.0" }
    await saveMig(child)
    render(<MigEditor migKey={getMigKey(child)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    expect(screen.getByText(/which isn.t loaded/i)).toBeInTheDocument()
  })

  it("warns when the MIG's message isn't in the repository", async () => {
    const orphan: MessageImplementationGuide = {
      ...MIG,
      name: "Orphan",
      messageIdentifier: "camt.999.001.01",
    }
    await saveMig(orphan)
    render(<MigEditor migKey={getMigKey(orphan)} repo={REPO} />)

    expect(await screen.findByText(/isn’t in the loaded e-Repository/i)).toBeInTheDocument()
  })
})
