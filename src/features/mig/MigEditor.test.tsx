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
            elements: [
              el("GrpHdr", { baseType: "Text", minLength: 1, maxLength: 35 }),
              el("CdtTrfTxInf", { elements: [el("Amt")] }),
              el("Rate", {
                baseType: "Rate",
                minInclusive: 0,
                maxInclusive: 100,
                examples: ["1.5", "2.0"],
              }),
              el("Sts", {
                baseType: "CodeSet",
                codes: [
                  { codeName: "ACTV", definition: "" },
                  { codeName: "INAC", definition: "" },
                ],
              }),
            ],
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
    // Overridden state is conveyed by a dot whose tooltip names the baseline.
    expect(within(panel).getByTitle(/overridden/i)).toBeInTheDocument()

    // Reset removes the override entirely.
    await user.click(within(panel).getByRole("button", { name: /reset to inherited/i }))
    expect((await loadMig(getMigKey(MIG)))?.elementOverrides["DocumentTag"]).toBeUndefined()
    expect(within(panel).queryByTitle(/overridden/i)).not.toBeInTheDocument()
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

  it("shows Min/Max length only for length-bearing types and edits them", async () => {
    const user = userEvent.setup()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })
    const panel = screen.getByRole("region", { name: /element details/i })

    // The root (Document) has no base type → no length fields.
    expect(within(panel).queryByRole("button", { name: "Edit Max length" })).not.toBeInTheDocument()

    // GrpHdr is a Text type → length fields appear. (The panel remounts per
    // selection, so re-query it after navigating.)
    await user.click(screen.getByRole("treeitem", { name: "GrpHdr" }))
    const grpPanel = screen.getByRole("region", { name: /element details/i })
    await user.click(within(grpPanel).getByRole("button", { name: "Edit Max length" }))
    const maxLen = within(grpPanel).getByRole("spinbutton", { name: "Max length" })
    await user.clear(maxLen)
    await user.type(maxLen, "20")
    await user.tab()

    expect((await loadMig(getMigKey(MIG)))?.elementOverrides["DocumentTag/GrpHdrTag"]?.maxLength).toBe(
      20,
    )
  })

  it("shows Min/Max inclusive for numeric types and accepts decimals", async () => {
    const user = userEvent.setup()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    // The root (Document) has no base type → no inclusive fields.
    const rootPanel = screen.getByRole("region", { name: /element details/i })
    expect(
      within(rootPanel).queryByRole("button", { name: "Edit Max inclusive" }),
    ).not.toBeInTheDocument()

    // Rate is a Rate type → inclusive fields appear and accept a decimal.
    await user.click(screen.getByRole("treeitem", { name: "Rate" }))
    const panel = screen.getByRole("region", { name: /element details/i })
    await user.click(within(panel).getByRole("button", { name: "Edit Max inclusive" }))
    const maxIncl = within(panel).getByRole("spinbutton", { name: "Max inclusive" })
    await user.clear(maxIncl)
    await user.type(maxIncl, "99.99")
    await user.tab()

    expect(
      (await loadMig(getMigKey(MIG)))?.elementOverrides["DocumentTag/RateTag"]?.maxInclusive,
    ).toBe(99.99)
  })

  it("edits a pattern override for pattern-bearing types", async () => {
    const user = userEvent.setup()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    // The root (Document) has no base type → no pattern field.
    const rootPanel = screen.getByRole("region", { name: /element details/i })
    expect(within(rootPanel).queryByRole("button", { name: "Edit Pattern" })).not.toBeInTheDocument()

    // GrpHdr is a Text type → pattern field appears.
    await user.click(screen.getByRole("treeitem", { name: "GrpHdr" }))
    const panel = screen.getByRole("region", { name: /element details/i })
    await user.click(within(panel).getByRole("button", { name: "Edit Pattern" }))
    // Note: userEvent treats { and [ as special, so use a brace-free regex.
    await user.type(within(panel).getByRole("textbox", { name: "Pattern" }), "\\d\\d\\d")
    await user.tab()

    expect((await loadMig(getMigKey(MIG)))?.elementOverrides["DocumentTag/GrpHdrTag"]?.pattern).toBe(
      "\\d\\d\\d",
    )
  })

  it("edits allowed values for code sets", async () => {
    const user = userEvent.setup()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    // The root (Document) has no base type → no allowed-values editor.
    const rootPanel = screen.getByRole("region", { name: /element details/i })
    expect(
      within(rootPanel).queryByRole("textbox", { name: /add to allowed values/i }),
    ).not.toBeInTheDocument()

    // Sts is a CodeSet → its inherited codes are editable; remove one.
    await user.click(screen.getByRole("treeitem", { name: "Sts" }))
    const panel = screen.getByRole("region", { name: /element details/i })
    await user.click(within(panel).getByRole("button", { name: "Remove INAC" }))
    expect((await loadMig(getMigKey(MIG)))?.elementOverrides["DocumentTag/StsTag"]?.allowedValues).toEqual([
      "ACTV",
    ])

    // Add a custom value (Enter adds, avoiding the per-list Add buttons).
    await user.type(
      within(panel).getByRole("textbox", { name: /add to allowed values/i }),
      "PEND{Enter}",
    )
    expect((await loadMig(getMigKey(MIG)))?.elementOverrides["DocumentTag/StsTag"]?.allowedValues).toEqual([
      "ACTV",
      "PEND",
    ])
  })

  it("edits examples for simple types", async () => {
    const user = userEvent.setup()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    // The root (Document) is a complex type → no examples editor.
    const rootPanel = screen.getByRole("region", { name: /element details/i })
    expect(
      within(rootPanel).queryByRole("textbox", { name: /add to examples/i }),
    ).not.toBeInTheDocument()

    // Rate is a simple type → its inherited examples are editable; remove one.
    await user.click(screen.getByRole("treeitem", { name: "Rate" }))
    const panel = screen.getByRole("region", { name: /element details/i })
    await user.click(within(panel).getByRole("button", { name: "Remove 2.0" }))
    expect((await loadMig(getMigKey(MIG)))?.elementOverrides["DocumentTag/RateTag"]?.examples).toEqual([
      "1.5",
    ])
  })

  it("flags allowed values that violate the length facet", async () => {
    const user = userEvent.setup()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    // GrpHdr is Text with maxLength 35.
    await user.click(screen.getByRole("treeitem", { name: "GrpHdr" }))
    const panel = screen.getByRole("region", { name: /element details/i })
    const input = within(panel).getByRole("textbox", { name: /add to allowed values/i })

    await user.type(input, "x".repeat(40))
    // Live warning while typing the (too-long) draft value.
    expect(within(panel).getByText(/longer than max length 35/i)).toBeInTheDocument()

    await user.keyboard("{Enter}")
    // Once added, the offending chip carries the warning as a tooltip.
    expect(within(panel).getByTitle(/longer than max length 35/i)).toBeInTheDocument()
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
