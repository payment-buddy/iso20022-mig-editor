// @vitest-environment jsdom
import "fake-indexeddb/auto"
import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
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
import { downloadMigCsv, downloadMigMarkdown, downloadMigs } from "./downloadMigs"

// The DOM download side-effect is exercised separately (downloadMigs.save.test.ts);
// here we only assert the editor wires its export buttons to it.
vi.mock("./downloadMigs", () => ({
  downloadMigs: vi.fn(),
  downloadMigMarkdown: vi.fn(),
  downloadMigCsv: vi.fn(),
}))

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
    // The MIG name is an inline-editable title in the header.
    expect(screen.getByRole("button", { name: "Edit MIG name" })).toBeInTheDocument()
    expect(screen.getAllByText("EPC Guide").length).toBeGreaterThan(0)
    // Root is expanded by default.
    expect(screen.getByRole("treeitem", { name: "GrpHdr" })).toBeInTheDocument()
    // Grandchild stays collapsed until its parent is expanded.
    expect(screen.queryByRole("treeitem", { name: "Amt" })).not.toBeInTheDocument()
  })

  it("downloads the current MIG as YAML from the header button", async () => {
    const user = userEvent.setup()
    vi.mocked(downloadMigs).mockClear()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    await user.click(screen.getByRole("button", { name: /download/i }))
    expect(downloadMigs).toHaveBeenCalledTimes(1)
    // Called with the MIG and a schema-order index (Map) for its overrides.
    expect(downloadMigs).toHaveBeenCalledWith(
      [expect.objectContaining({ name: "EPC Guide", version: "1.0" })],
      expect.any(Map),
    )
  })

  it("exports a Markdown report from the Export menu", async () => {
    const user = userEvent.setup()
    vi.mocked(downloadMigMarkdown).mockClear()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    await user.click(screen.getByRole("button", { name: /export/i }))
    await user.click(await screen.findByRole("menuitem", { name: /markdown/i }))
    expect(downloadMigMarkdown).toHaveBeenCalledTimes(1)
    // Called with the MIG, the loaded MIGs (for the parent chain), and its message.
    expect(downloadMigMarkdown).toHaveBeenCalledWith(
      expect.objectContaining({ name: "EPC Guide" }),
      expect.any(Array),
      expect.objectContaining({ identifier: "pacs.008.001.10" }),
    )
  })

  it("exports a CSV from the Export menu", async () => {
    const user = userEvent.setup()
    vi.mocked(downloadMigCsv).mockClear()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    await user.click(screen.getByRole("button", { name: /export/i }))
    await user.click(await screen.findByRole("menuitem", { name: /csv/i }))
    expect(downloadMigCsv).toHaveBeenCalledTimes(1)
    expect(downloadMigCsv).toHaveBeenCalledWith(
      expect.objectContaining({ name: "EPC Guide" }),
      expect.any(Array),
      expect.objectContaining({ identifier: "pacs.008.001.10" }),
    )
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

  it("warns (but does not block) when max occurs is below min occurs", async () => {
    const user = userEvent.setup()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })
    const panel = screen.getByRole("region", { name: /element details/i })

    // Raise min occurs above the (ISO 1) max occurs → advisory warning, not blocked.
    await user.click(within(panel).getByRole("button", { name: "Edit Min occurs" }))
    const input = within(panel).getByRole("spinbutton", { name: "Min occurs" })
    await user.clear(input)
    await user.type(input, "2")
    await user.tab()

    expect(within(panel).getByRole("alert")).toHaveTextContent(/max 1 is below min 2/i)
    // The value is still accepted (advisory, non-blocking).
    expect((await loadMig(getMigKey(MIG)))?.elementOverrides["DocumentTag"]?.minOccurs).toBe(2)
  })

  it("warns when an element is excluded (max 0) but min occurs still requires it", async () => {
    const user = userEvent.setup()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })
    // GrpHdr is mandatory (min occurs 1, inherited from ISO).
    await user.click(screen.getByRole("treeitem", { name: "GrpHdr" }))
    const panel = screen.getByRole("region", { name: /element details/i })

    await user.click(within(panel).getByRole("button", { name: "Edit Max occurs" }))
    const input = within(panel).getByRole("spinbutton", { name: "Max occurs" })
    await user.clear(input)
    await user.type(input, "0")
    await user.tab()

    // Excluding while min still requires it: max 0 < min 1 is flagged.
    expect(within(panel).getByRole("alert")).toHaveTextContent(/max 0 is below min 1/i)
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

  it("shows the effective cardinality in the tree (own override)", async () => {
    // GrpHdr is [1..1] in ISO; overriding maxOccurs to 5 shows [1..5] in the tree.
    await saveMig({ ...MIG, elementOverrides: { "DocumentTag/GrpHdrTag": { maxOccurs: 5 } } })
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })
    const grpHdr = screen.getByRole("treeitem", { name: "GrpHdr" })
    expect(within(grpHdr).getByText("[1..5]")).toBeInTheDocument()
  })

  it("shows inherited cardinality from the parent MIG in the tree", async () => {
    const parent: MessageImplementationGuide = {
      name: "Base",
      version: "1",
      messageIdentifier: "pacs.008.001.10",
      elementOverrides: { "DocumentTag/GrpHdrTag": { maxOccurs: 3 } },
    }
    const child: MessageImplementationGuide = {
      name: "Child",
      version: "1",
      messageIdentifier: "pacs.008.001.10",
      parentMIG: "Base:1",
      elementOverrides: {},
    }
    await saveMig(parent)
    await saveMig(child)
    render(<MigEditor migKey={getMigKey(child)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })
    const grpHdr = screen.getByRole("treeitem", { name: "GrpHdr" })
    // [1..3] inherited from the parent, though the child has no own override.
    expect(within(grpHdr).getByText("[1..3]")).toBeInTheDocument()
  })

  it("counts and hides elements excluded via a maxOccurs:0 override", async () => {
    const user = userEvent.setup()
    // Exclude CdtTrfTxInf by overriding its effective maxOccurs to 0.
    await saveMig({ ...MIG, elementOverrides: { "DocumentTag/CdtTrfTxInfTag": { maxOccurs: 0 } } })
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    // The override styles the row as excluded and feeds the toggle's count.
    const row = screen.getByRole("treeitem", { name: "CdtTrfTxInf" })
    expect(within(row).getByText("excluded")).toBeInTheDocument()
    const toggle = screen.getByLabelText(/hide excluded \(1\)/i)
    expect(toggle).toBeEnabled()

    // Toggling on drops the excluded element (and its subtree) from the tree.
    await user.click(toggle)
    expect(screen.queryByRole("treeitem", { name: "CdtTrfTxInf" })).not.toBeInTheDocument()
  })

  it("adds a MIG-specific constraint, revealing and selecting it in the tree", async () => {
    const user = userEvent.setup()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })
    const panel = screen.getByRole("region", { name: /element details/i })

    // Root (Document) is selected by default; add a constraint to it.
    await user.click(within(panel).getByRole("button", { name: /add constraint/i }))

    // The constraint appears in the tree, tagged "added", and is now selected.
    const node = await screen.findByRole("treeitem", { name: /constraint new constraint$/i })
    expect(within(node).getByText("added")).toBeInTheDocument()
    expect(node).toHaveAttribute("aria-selected", "true")

    // Persisted as a MIG-specific (additional) constraint on the root path.
    expect(
      (await loadMig(getMigKey(MIG)))?.elementOverrides["DocumentTag"]?.additionalConstraints,
    ).toEqual([{ name: "New constraint", definition: "" }])
  })

  it("gives each added constraint a non-duplicate name", async () => {
    const user = userEvent.setup()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    // Add once (selection moves to the new constraint), re-select the element,
    // then add again — the second name must not collide with the first.
    const add = async () => {
      const panel = screen.getByRole("region", { name: /element details/i })
      await user.click(within(panel).getByRole("button", { name: /add constraint/i }))
    }
    await add()
    await user.click(screen.getByRole("treeitem", { name: "Document" }))
    await add()

    const names = (await loadMig(getMigKey(MIG)))?.elementOverrides[
      "DocumentTag"
    ]?.additionalConstraints?.map((c) => c.name)
    expect(names).toEqual(["New constraint", "New constraint 2"])
  })

  it("edits an added constraint's definition", async () => {
    const user = userEvent.setup()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    // Add a constraint (selection moves to it → constraint detail panel).
    const elementPanel = screen.getByRole("region", { name: /element details/i })
    await user.click(within(elementPanel).getByRole("button", { name: /add constraint/i }))
    const panel = await screen.findByRole("region", { name: /constraint details/i })

    await user.click(within(panel).getByRole("button", { name: "Edit Constraint definition" }))
    await user.type(
      within(panel).getByRole("textbox", { name: "Constraint definition" }),
      "Must reference a settlement date",
    )
    await user.tab() // blur commits

    expect(
      (await loadMig(getMigKey(MIG)))?.elementOverrides["DocumentTag"]?.additionalConstraints,
    ).toEqual([{ name: "New constraint", definition: "Must reference a settlement date" }])
  })

  it("edits an added constraint's expression", async () => {
    const user = userEvent.setup()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    const elementPanel = screen.getByRole("region", { name: /element details/i })
    await user.click(within(elementPanel).getByRole("button", { name: /add constraint/i }))
    const panel = await screen.findByRole("region", { name: /constraint details/i })

    await user.click(within(panel).getByRole("button", { name: "Edit Constraint expression" }))
    await user.type(
      within(panel).getByRole("textbox", { name: "Constraint expression" }),
      "Amt > 0",
    )
    await user.tab() // blur commits

    // Expression is stored as an optional field alongside name/definition.
    expect(
      (await loadMig(getMigKey(MIG)))?.elementOverrides["DocumentTag"]?.additionalConstraints,
    ).toEqual([{ name: "New constraint", definition: "", expression: "Amt > 0" }])
  })

  it("renames an added constraint, keeping it selected in the tree", async () => {
    const user = userEvent.setup()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    const elementPanel = screen.getByRole("region", { name: /element details/i })
    await user.click(within(elementPanel).getByRole("button", { name: /add constraint/i }))
    const panel = await screen.findByRole("region", { name: /constraint details/i })

    await user.click(within(panel).getByRole("button", { name: "Edit Constraint name" }))
    const input = within(panel).getByRole("textbox", { name: "Constraint name" })
    await user.clear(input)
    await user.type(input, "Settlement rule")
    await user.tab() // blur commits

    // Renamed in storage and re-selected in the tree under its new path.
    expect(
      (await loadMig(getMigKey(MIG)))?.elementOverrides["DocumentTag"]?.additionalConstraints,
    ).toEqual([{ name: "Settlement rule", definition: "" }])
    const node = await screen.findByRole("treeitem", { name: /constraint settlement rule$/i })
    expect(node).toHaveAttribute("aria-selected", "true")
  })

  it("rejects a rename that duplicates a sibling constraint name", async () => {
    const user = userEvent.setup()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    // Two constraints on the root; the second stays selected.
    const add = async () => {
      const p = screen.getByRole("region", { name: /element details/i })
      await user.click(within(p).getByRole("button", { name: /add constraint/i }))
    }
    await add()
    await user.click(screen.getByRole("treeitem", { name: "Document" }))
    await add()

    // Try to rename "New constraint 2" → "New constraint" (taken): no change.
    const panel = screen.getByRole("region", { name: /constraint details/i })
    await user.click(within(panel).getByRole("button", { name: "Edit Constraint name" }))
    const input = within(panel).getByRole("textbox", { name: "Constraint name" })
    await user.clear(input)
    await user.type(input, "New constraint")
    await user.tab()

    const names = (await loadMig(getMigKey(MIG)))?.elementOverrides[
      "DocumentTag"
    ]?.additionalConstraints?.map((c) => c.name)
    expect(names).toEqual(["New constraint", "New constraint 2"])
  })

  it("overlays an expression on a standard constraint (name/definition stay read-only)", async () => {
    const user = userEvent.setup()
    const repo: ERepository = {
      businessAreas: [
        {
          name: "A",
          code: "a",
          definition: "",
          messages: [
            {
              name: "Msg",
              identifier: "pacs.008.001.10",
              shortCode: "pacs.008",
              rootElement: el("Document", {
                constraints: [{ name: "StdRule", definition: "Spec rule" }],
              }),
            },
          ],
        },
      ],
    }
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={repo} />)
    await screen.findByRole("treeitem", { name: "Document" })

    // Select the standard constraint (a child of the expanded root).
    await user.click(screen.getByRole("treeitem", { name: /constraint stdrule/i }))

    const panel = screen.getByRole("region", { name: /constraint details/i })
    expect(within(panel).getByText("StdRule")).toBeInTheDocument()
    // Name stays read-only and a standard rule can't be deleted (definition and
    // expression are overlay-editable below).
    expect(within(panel).queryByRole("button", { name: "Edit Constraint name" })).not.toBeInTheDocument()
    expect(within(panel).queryByRole("button", { name: /delete constraint/i })).not.toBeInTheDocument()

    // The expression, however, can be overlaid — stored under constraintOverrides.
    await user.click(within(panel).getByRole("button", { name: "Edit Constraint expression" }))
    await user.type(within(panel).getByRole("textbox", { name: "Constraint expression" }), "Amt > 0")
    await user.tab()

    expect(
      (await loadMig(getMigKey(MIG)))?.elementOverrides["DocumentTag"]?.constraintOverrides,
    ).toEqual({ StdRule: { expression: "Amt > 0" } })
  })

  it("shows provenance dots in the constraint overlay panel", async () => {
    const user = userEvent.setup()
    const repo: ERepository = {
      businessAreas: [
        {
          name: "A",
          code: "a",
          definition: "",
          messages: [
            {
              name: "Msg",
              identifier: "pacs.008.001.10",
              shortCode: "pacs.008",
              rootElement: el("Document", {
                constraints: [{ name: "StdRule", definition: "Spec rule" }],
              }),
            },
          ],
        },
      ],
    }
    const parent: MessageImplementationGuide = {
      name: "Base",
      version: "1.0",
      messageIdentifier: "pacs.008.001.10",
      elementOverrides: { DocumentTag: { constraintOverrides: { StdRule: { expression: "x > 0" } } } },
    }
    const child: MessageImplementationGuide = { ...MIG, parentMIG: getMigKey(parent) }
    await saveMig(parent)
    await saveMig(child)
    render(<MigEditor migKey={getMigKey(child)} repo={repo} />)
    await screen.findByRole("treeitem", { name: "Document" })
    await user.click(screen.getByRole("treeitem", { name: /constraint stdrule/i }))
    const panel = screen.getByRole("region", { name: /constraint details/i })

    // Expression is inherited from the parent's overlay → violet dot.
    const inheritedDot = within(panel).getByTitle(/inherited from a parent mig: x > 0/i)
    expect(inheritedDot).toHaveClass("rounded-full", "bg-violet-600")

    // Override it here → blue dot, baseline still the inherited value.
    await user.click(within(panel).getByRole("button", { name: "Edit Constraint expression" }))
    const input = within(panel).getByRole("textbox", { name: "Constraint expression" })
    await user.clear(input)
    await user.type(input, "Amt > 0")
    await user.tab()
    const ownDot = within(panel).getByTitle(/overridden — inherited: x > 0/i)
    expect(ownDot).toHaveClass("rounded-full", "bg-primary")
  })

  it("disables a standard constraint via the toggle", async () => {
    const user = userEvent.setup()
    const repo: ERepository = {
      businessAreas: [
        {
          name: "A",
          code: "a",
          definition: "",
          messages: [
            {
              name: "Msg",
              identifier: "pacs.008.001.10",
              shortCode: "pacs.008",
              rootElement: el("Document", {
                constraints: [{ name: "StdRule", definition: "Spec rule" }],
              }),
            },
          ],
        },
      ],
    }
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={repo} />)
    await screen.findByRole("treeitem", { name: "Document" })
    await user.click(screen.getByRole("treeitem", { name: /constraint stdrule/i }))

    const panel = screen.getByRole("region", { name: /constraint details/i })
    await user.click(within(panel).getByRole("checkbox", { name: /disable this rule/i }))

    expect(
      (await loadMig(getMigKey(MIG)))?.elementOverrides["DocumentTag"]?.constraintOverrides,
    ).toEqual({ StdRule: { disabled: true } })
  })

  it("colours an own-overridden node and shows the legend", async () => {
    const guide: MessageImplementationGuide = {
      ...MIG,
      elementOverrides: { "DocumentTag/GrpHdrTag": { maxLength: 20 } },
    }
    await saveMig(guide)
    render(<MigEditor migKey={getMigKey(guide)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: /Document/ })

    expect(screen.getByText("Overridden here")).toBeInTheDocument()
    const item = screen.getByRole("treeitem", { name: /GrpHdr/ })
    expect(item.querySelector(".text-primary")?.textContent).toBe("GrpHdr")
  })

  it("filters to changes (and their ancestors) via the 'Only changes' toggle", async () => {
    const user = userEvent.setup()
    const guide: MessageImplementationGuide = {
      ...MIG,
      elementOverrides: {
        "DocumentTag/GrpHdrTag": {
          maxLength: 20,
          additionalConstraints: [{ name: "MyRule", definition: "" }],
        },
      },
    }
    await saveMig(guide)
    render(<MigEditor migKey={getMigKey(guide)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })
    // An unchanged sibling is visible before filtering.
    expect(screen.getByRole("treeitem", { name: /Rate/ })).toBeInTheDocument()

    await user.click(screen.getByRole("checkbox", { name: /only changes/i }))

    // The changed element, its added constraint, and the ancestor remain…
    expect(screen.getByRole("treeitem", { name: "Document" })).toBeInTheDocument()
    expect(screen.getByRole("treeitem", { name: /GrpHdr/ })).toBeInTheDocument()
    expect(screen.getByRole("treeitem", { name: /constraint myrule/i })).toBeInTheDocument()
    // …while unchanged siblings are filtered out.
    expect(screen.queryByRole("treeitem", { name: /Rate/ })).not.toBeInTheDocument()
  })

  it("colours a node overridden only by a parent MIG in the inherited colour", async () => {
    const parent: MessageImplementationGuide = {
      name: "Base",
      version: "1.0",
      messageIdentifier: "pacs.008.001.10",
      elementOverrides: { "DocumentTag/GrpHdrTag": { maxLength: 20 } },
    }
    const child: MessageImplementationGuide = { ...MIG, parentMIG: getMigKey(parent) }
    await saveMig(parent)
    await saveMig(child)
    render(<MigEditor migKey={getMigKey(child)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: /Document/ })

    const item = screen.getByRole("treeitem", { name: /GrpHdr/ })
    expect(item.querySelector(".text-violet-600")?.textContent).toBe("GrpHdr")
    // It isn't this MIG's own override.
    expect(item.querySelector(".text-primary")).toBeNull()
  })

  it("does not tint an element that has only a constraint override, but tints the constraint", async () => {
    const guide: MessageImplementationGuide = {
      ...MIG,
      elementOverrides: { DocumentTag: { additionalConstraints: [{ name: "Mine", definition: "" }] } },
    }
    await saveMig(guide)
    render(<MigEditor migKey={getMigKey(guide)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: /Document/ })

    // The element itself carries no element-field override → no tint.
    const doc = screen.getByRole("treeitem", { name: /Document/ })
    expect(doc.querySelector(".text-primary")).toBeNull()
    expect(doc.querySelector(".text-violet-600")).toBeNull()
    // The added constraint node is tinted by its own provenance.
    const con = screen.getByRole("treeitem", { name: /constraint mine/i })
    expect(con.querySelector(".text-primary")?.textContent).toContain("Mine")
  })

  it("tints a standard constraint this MIG overlays, leaving untouched ISO rules plain", async () => {
    const repo: ERepository = {
      businessAreas: [
        {
          name: "A",
          code: "a",
          definition: "",
          messages: [
            {
              name: "Msg",
              identifier: "pacs.008.001.10",
              shortCode: "pacs.008",
              rootElement: el("Document", {
                constraints: [
                  { name: "StdRule", definition: "d" },
                  { name: "Plain", definition: "d" },
                ],
              }),
            },
          ],
        },
      ],
    }
    const guide: MessageImplementationGuide = {
      ...MIG,
      elementOverrides: { DocumentTag: { constraintOverrides: { StdRule: { expression: "x > 0" } } } },
    }
    await saveMig(guide)
    render(<MigEditor migKey={getMigKey(guide)} repo={repo} />)
    await screen.findByRole("treeitem", { name: /Document/ })

    const overlaid = screen.getByRole("treeitem", { name: /constraint stdrule/i })
    expect(overlaid.querySelector(".text-primary")?.textContent).toContain("StdRule")
    const plain = screen.getByRole("treeitem", { name: /constraint plain/i })
    expect(plain.querySelector(".text-primary")).toBeNull()
    expect(plain.querySelector(".text-violet-600")).toBeNull()
  })

  it("shows an inherited (parent-MIG) constraint and overlays an expression on it", async () => {
    const user = userEvent.setup()
    const parent: MessageImplementationGuide = {
      name: "Base",
      version: "1.0",
      messageIdentifier: "pacs.008.001.10",
      elementOverrides: {
        DocumentTag: { additionalConstraints: [{ name: "InhRule", definition: "Inherited rule" }] },
      },
    }
    const child: MessageImplementationGuide = { ...MIG, parentMIG: getMigKey(parent) }
    await saveMig(parent)
    await saveMig(child)
    render(<MigEditor migKey={getMigKey(child)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    // The inherited constraint is visible (it isn't in this MIG's own overrides).
    await user.click(screen.getByRole("treeitem", { name: /constraint inhrule/i }))
    const panel = screen.getByRole("region", { name: /constraint details/i })
    // It uses the overlay panel: no rename/delete, but an editable expression.
    expect(within(panel).queryByRole("button", { name: "Edit Constraint name" })).not.toBeInTheDocument()
    expect(within(panel).queryByRole("button", { name: /delete constraint/i })).not.toBeInTheDocument()

    await user.click(within(panel).getByRole("button", { name: "Edit Constraint expression" }))
    await user.type(within(panel).getByRole("textbox", { name: "Constraint expression" }), "Amt > 0")
    await user.tab()

    // The overlay lands on the child MIG, keyed by the inherited rule's name.
    expect(
      (await loadMig(getMigKey(child)))?.elementOverrides["DocumentTag"]?.constraintOverrides,
    ).toEqual({ InhRule: { expression: "Amt > 0" } })
  })

  it("deletes an added constraint after confirming, cancelling is a no-op", async () => {
    const user = userEvent.setup()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    const elementPanel = screen.getByRole("region", { name: /element details/i })
    await user.click(within(elementPanel).getByRole("button", { name: /add constraint/i }))
    const panel = await screen.findByRole("region", { name: /constraint details/i })

    // Cancelling the confirm leaves the constraint in place.
    await user.click(within(panel).getByRole("button", { name: /delete constraint/i }))
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }))
    expect(screen.getByRole("treeitem", { name: /constraint new constraint$/i })).toBeInTheDocument()

    // Confirming removes it and selection falls back to the owning element.
    await user.click(within(panel).getByRole("button", { name: /delete constraint/i }))
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }))

    expect(
      screen.queryByRole("treeitem", { name: /constraint new constraint$/i }),
    ).not.toBeInTheDocument()
    expect((await loadMig(getMigKey(MIG)))?.elementOverrides["DocumentTag"]).toBeUndefined()
    expect(screen.getByRole("treeitem", { name: "Document" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
  })

  it("shows the parent MIG's value as the inherited baseline and resets to it", async () => {
    const user = userEvent.setup()
    const parent: MessageImplementationGuide = {
      name: "Base",
      version: "1",
      messageIdentifier: "pacs.008.001.10",
      elementOverrides: { "DocumentTag/GrpHdrTag": { maxLength: 20 } },
    }
    const child: MessageImplementationGuide = {
      name: "Child",
      version: "1",
      messageIdentifier: "pacs.008.001.10",
      parentMIG: "Base:1",
      elementOverrides: {},
    }
    await saveMig(parent)
    await saveMig(child)
    render(<MigEditor migKey={getMigKey(child)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })
    await user.click(screen.getByRole("treeitem", { name: "GrpHdr" }))
    const panel = screen.getByRole("region", { name: /element details/i })

    // Max length inherits the parent's 20 (not the ISO 35), flagged with a violet
    // "inherited" dot (consistent with the element-tree tint).
    const inheritedDot = within(panel).getByTitle(/inherited from a parent mig: 20/i)
    expect(inheritedDot).toBeInTheDocument()
    expect(inheritedDot).toHaveClass("rounded-full", "bg-violet-600")
    await user.click(within(panel).getByRole("button", { name: "Edit Max length" }))
    expect(within(panel).getByRole("spinbutton", { name: "Max length" })).toHaveValue(20)

    // Override it here → its baseline (reset target) is still the inherited 20.
    const input = within(panel).getByRole("spinbutton", { name: "Max length" })
    await user.clear(input)
    await user.type(input, "15")
    await user.tab()
    expect(
      (await loadMig(getMigKey(child)))?.elementOverrides["DocumentTag/GrpHdrTag"]?.maxLength,
    ).toBe(15)
    const ownDot = within(panel).getByTitle(/overridden — inherited: 20/i)
    expect(ownDot).toBeInTheDocument()
    expect(ownDot).toHaveClass("rounded-full", "bg-primary")

    // Reset drops the own override → back to inheriting the parent's 20.
    await user.click(within(panel).getByRole("button", { name: /reset to inherited/i }))
    expect(
      (await loadMig(getMigKey(child)))?.elementOverrides["DocumentTag/GrpHdrTag"],
    ).toBeUndefined()
    expect(within(panel).getByTitle(/inherited from a parent mig: 20/i)).toBeInTheDocument()
  })

  it("shows Total/Fraction digits only for digit-bearing types and edits them", async () => {
    const user = userEvent.setup()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    // GrpHdr (Text) has no digits facet.
    await user.click(screen.getByRole("treeitem", { name: "GrpHdr" }))
    expect(
      within(screen.getByRole("region", { name: /element details/i })).queryByRole("button", {
        name: "Edit Total digits",
      }),
    ).not.toBeInTheDocument()

    // Rate (baseType Rate) does — edit its fraction digits.
    await user.click(screen.getByRole("treeitem", { name: "Rate" }))
    const panel = screen.getByRole("region", { name: /element details/i })
    expect(within(panel).getByRole("button", { name: "Edit Total digits" })).toBeInTheDocument()
    await user.click(within(panel).getByRole("button", { name: "Edit Fraction digits" }))
    const input = within(panel).getByRole("spinbutton", { name: "Fraction digits" })
    await user.clear(input)
    await user.type(input, "2")
    await user.tab()
    expect(
      (await loadMig(getMigKey(MIG)))?.elementOverrides["DocumentTag/RateTag"]?.fractionDigits,
    ).toBe(2)
  })

  it("warns when fraction digits are raised above the original (loosening)", async () => {
    const user = userEvent.setup()
    const repo: ERepository = {
      businessAreas: [
        {
          name: "A",
          code: "a",
          definition: "",
          messages: [
            {
              name: "Msg",
              identifier: "pacs.008.001.10",
              shortCode: "pacs.008",
              rootElement: el("Document", {
                elements: [el("Amt", { baseType: "Amount", fractionDigits: 2 })],
              }),
            },
          ],
        },
      ],
    }
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={repo} />)
    await screen.findByRole("treeitem", { name: "Document" })
    await user.click(screen.getByRole("treeitem", { name: "Amt" }))
    const panel = screen.getByRole("region", { name: /element details/i })

    // No warning at the original 2 fraction digits.
    expect(within(panel).queryByRole("alert")).not.toBeInTheDocument()

    // Raise it to 5 → loosens, so a warning appears.
    await user.click(within(panel).getByRole("button", { name: "Edit Fraction digits" }))
    const input = within(panel).getByRole("spinbutton", { name: "Fraction digits" })
    await user.clear(input)
    await user.type(input, "5")
    await user.tab()
    expect(within(panel).getByRole("alert")).toHaveTextContent(/looser than the original/i)
  })

  it("warns when min occurs drops below the original", async () => {
    const user = userEvent.setup()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })
    await user.click(screen.getByRole("treeitem", { name: "GrpHdr" }))
    const panel = screen.getByRole("region", { name: /element details/i })

    expect(within(panel).queryByRole("alert")).not.toBeInTheDocument()
    await user.click(within(panel).getByRole("button", { name: "Edit Min occurs" }))
    const input = within(panel).getByRole("spinbutton", { name: "Min occurs" })
    await user.clear(input)
    await user.type(input, "0")
    await user.tab()
    expect(within(panel).getByRole("alert")).toHaveTextContent(/min occurs 0 is below 1/i)
  })

  it("flags a pattern that isn't a valid regular expression", async () => {
    const user = userEvent.setup()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })
    await user.click(screen.getByRole("treeitem", { name: "GrpHdr" }))
    const panel = screen.getByRole("region", { name: /element details/i })

    await user.click(within(panel).getByRole("button", { name: "Edit Pattern" }))
    // An unbalanced group — invalid regex (brackets are special to user-event).
    await user.type(within(panel).getByRole("textbox", { name: "Pattern" }), "(")
    await user.tab()
    expect(within(panel).getByRole("alert")).toHaveTextContent(/invalid pattern/i)
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

    // Sts is a CodeSet → its inherited codes are editable; enter edit, remove one.
    await user.click(screen.getByRole("treeitem", { name: "Sts" }))
    const panel = screen.getByRole("region", { name: /element details/i })
    await user.click(within(panel).getByRole("button", { name: "Edit Allowed values" }))
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

    // Rate is a simple type → its inherited examples are editable; enter edit, remove one.
    await user.click(screen.getByRole("treeitem", { name: "Rate" }))
    const panel = screen.getByRole("region", { name: /element details/i })
    await user.click(within(panel).getByRole("button", { name: "Edit Examples" }))
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
    await user.click(within(panel).getByRole("button", { name: "Edit Allowed values" }))
    const input = within(panel).getByRole("textbox", { name: /add to allowed values/i })

    await user.type(input, "x".repeat(40))
    // Live warning while typing the (too-long) draft value.
    expect(within(panel).getByText(/longer than max length 35/i)).toBeInTheDocument()

    await user.keyboard("{Enter}")
    // Once added, the offending chip carries the warning as a tooltip.
    expect(within(panel).getByTitle(/longer than max length 35/i)).toBeInTheDocument()
  })

  it("flags examples that exceed the fraction-digits facet", async () => {
    const user = userEvent.setup()
    const repo: ERepository = {
      businessAreas: [
        {
          name: "A",
          code: "a",
          definition: "",
          messages: [
            {
              name: "Msg",
              identifier: "pacs.008.001.10",
              shortCode: "pacs.008",
              rootElement: el("Document", {
                elements: [el("Amt", { baseType: "Amount", fractionDigits: 2 })],
              }),
            },
          ],
        },
      ],
    }
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={repo} />)
    await screen.findByRole("treeitem", { name: "Document" })
    await user.click(screen.getByRole("treeitem", { name: "Amt" }))
    const panel = screen.getByRole("region", { name: /element details/i })

    await user.click(within(panel).getByRole("button", { name: "Edit Examples" }))
    await user.type(within(panel).getByRole("textbox", { name: /add to examples/i }), "1.234")
    expect(within(panel).getByText(/more than 2 fraction digits/i)).toBeInTheDocument()
  })

  it("surfaces loosening diagnostics in the consistency banner/drawer", async () => {
    const user = userEvent.setup()
    // GrpHdr maxLength 35 → overriding to 50 loosens it.
    await saveMig({ ...MIG, elementOverrides: { "DocumentTag/GrpHdrTag": { maxLength: 50 } } })
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    await user.click(screen.getByRole("button", { name: /this mig has 1 issue/i }))
    const region = screen.getByRole("region", { name: /consistency diagnostics/i })
    expect(within(region).getByText(/above 35/i)).toBeInTheDocument()
    expect(within(region).getByText("GrpHdr")).toBeInTheDocument()

    // Clicking a diagnostic selects its element in the tree.
    await user.click(within(region).getByRole("button", { name: /grphdr/i }))
    expect(screen.getByRole("treeitem", { name: "GrpHdr" })).toHaveAttribute("aria-selected", "true")
  })

  it("shows no consistency banner for a clean MIG", async () => {
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })
    expect(screen.queryByRole("region", { name: /consistency diagnostics/i })).not.toBeInTheDocument()
  })

  it("validates a pasted message instance and navigates from a violation", async () => {
    const user = userEvent.setup()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    await user.click(screen.getByRole("button", { name: /^validate$/i }))
    const dialog = await screen.findByRole("dialog")
    // An empty Document → every required child is missing.
    await user.type(within(dialog).getByRole("textbox", { name: /message xml/i }), "<DocumentTag></DocumentTag>")
    await user.click(within(dialog).getByRole("button", { name: /^validate$/i }))

    const results = within(dialog).getByRole("region", { name: /validation results/i })
    const grpHdr = within(results).getByRole("button", { name: /grphdr.*minimum is 1/i })
    await user.click(grpHdr)

    // Clicking the violation closes the dialog and selects its element.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByRole("treeitem", { name: "GrpHdr" })).toHaveAttribute("aria-selected", "true")
  })

  it("declares custom property names in metadata and edits per-element values", async () => {
    const user = userEvent.setup()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })
    const meta = screen.getByRole("region", { name: /mig metadata/i })
    const panel = screen.getByRole("region", { name: /element details/i })

    // No names yet → no annotations section in the detail panel.
    expect(within(panel).queryByText("Annotations")).not.toBeInTheDocument()

    // Declare a shared element-annotation name in the metadata block.
    await user.click(within(meta).getByRole("button", { name: "Edit Element annotations" }))
    await user.type(
      within(meta).getByRole("textbox", { name: /add to element annotations/i }),
      "Usage",
    )
    await user.keyboard("{Enter}")
    expect((await loadMig(getMigKey(MIG)))?.elementAnnotationNames).toEqual(["Usage"])

    // Its value field now appears in the detail panel; set this element's value.
    await user.click(within(panel).getByRole("button", { name: "Edit Usage value" }))
    await user.type(within(panel).getByRole("textbox", { name: "Usage value" }), "debit only")
    await user.tab()
    expect(
      (await loadMig(getMigKey(MIG)))?.elementOverrides["DocumentTag"]?.annotations,
    ).toEqual({ Usage: "debit only" })

    // Removing the name in metadata drops it everywhere (cascades to overrides).
    await user.click(within(meta).getByRole("button", { name: "Edit Element annotations" }))
    await user.click(within(meta).getByRole("button", { name: "Remove Usage" }))
    const saved = await loadMig(getMigKey(MIG))
    expect(saved?.elementAnnotationNames).toBeUndefined()
    expect(saved?.elementOverrides["DocumentTag"]).toBeUndefined()
  })

  it("shows inherited annotation fields with a provenance dot, even when this MIG declares no names", async () => {
    const user = userEvent.setup()
    // The parent declares the names and sets both values; the child redeclares
    // nothing and only overrides one — the effective names come from the parent.
    const parent: MessageImplementationGuide = {
      name: "Base",
      version: "1.0",
      messageIdentifier: "pacs.008.001.10",
      elementAnnotationNames: ["Owner", "Usage"],
      elementOverrides: { "DocumentTag/GrpHdrTag": { annotations: { Owner: "ops", Usage: "credit" } } },
    }
    const child: MessageImplementationGuide = {
      ...MIG,
      parentMIG: getMigKey(parent),
      elementOverrides: { "DocumentTag/GrpHdrTag": { annotations: { Owner: "mine" } } },
    }
    await saveMig(parent)
    await saveMig(child)
    render(<MigEditor migKey={getMigKey(child)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })
    await user.click(screen.getByRole("treeitem", { name: "GrpHdr" }))
    const panel = screen.getByRole("region", { name: /element details/i })

    // Owner is overridden here (over the parent's "ops") → blue dot.
    expect(within(panel).getByTitle("Overridden — inherited: ops")).toHaveClass("bg-primary")
    expect(within(panel).getByText("mine")).toBeInTheDocument()
    // Usage is inherited from the parent → violet dot, and its value shows even
    // though the child declares no annotation names of its own.
    expect(within(panel).getByTitle("Inherited from a parent MIG: credit")).toHaveClass(
      "bg-violet-600",
    )
    expect(within(panel).getByText("credit")).toBeInTheDocument()
  })

  it("declares constraint-annotation names in metadata and edits per-constraint values", async () => {
    const user = userEvent.setup()
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })
    const meta = screen.getByRole("region", { name: /mig metadata/i })

    // Add a constraint (selection moves to it → constraint detail panel).
    const elementPanel = screen.getByRole("region", { name: /element details/i })
    await user.click(within(elementPanel).getByRole("button", { name: /add constraint/i }))
    const panel = await screen.findByRole("region", { name: /constraint details/i })

    // No constraint-annotation names yet → no annotations section in the panel.
    expect(within(panel).queryByText("Annotations")).not.toBeInTheDocument()

    // Declare a constraint-annotation name — its own list, separate from elements.
    await user.click(within(meta).getByRole("button", { name: "Edit Constraint annotations" }))
    await user.type(
      within(meta).getByRole("textbox", { name: /add to constraint annotations/i }),
      "Severity",
    )
    await user.keyboard("{Enter}")
    const declared = await loadMig(getMigKey(MIG))
    expect(declared?.constraintAnnotationNames).toEqual(["Severity"])
    expect(declared?.elementAnnotationNames).toBeUndefined()

    // The value field appears in the constraint panel; set this constraint's value.
    await user.click(within(panel).getByRole("button", { name: "Edit Severity value" }))
    await user.type(within(panel).getByRole("textbox", { name: "Severity value" }), "high")
    await user.tab()
    expect(
      (await loadMig(getMigKey(MIG)))?.elementOverrides["DocumentTag"]?.additionalConstraints,
    ).toEqual([{ name: "New constraint", definition: "", annotations: { Severity: "high" } }])
    // The set value is this MIG's own → a blue provenance dot.
    expect(within(panel).getByTitle("Overridden — inherited: —")).toHaveClass("bg-primary")

    // Removing the name strips the value but leaves the constraint in place.
    await user.click(within(meta).getByRole("button", { name: "Edit Constraint annotations" }))
    await user.click(within(meta).getByRole("button", { name: "Remove Severity" }))
    const saved = await loadMig(getMigKey(MIG))
    expect(saved?.constraintAnnotationNames).toBeUndefined()
    expect(saved?.elementOverrides["DocumentTag"]?.additionalConstraints).toEqual([
      { name: "New constraint", definition: "" },
    ])
  })

  it("re-versions the MIG (metadata), re-keys storage, repoints children and re-routes", async () => {
    const user = userEvent.setup()
    const child: MessageImplementationGuide = {
      name: "Child",
      version: "1",
      messageIdentifier: "pacs.008.001.10",
      parentMIG: "EPC Guide:1.0",
      elementOverrides: {},
    }
    await saveMig(MIG)
    await saveMig(child)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })
    const meta = screen.getByRole("region", { name: /mig metadata/i })

    await user.click(within(meta).getByRole("button", { name: "Edit Version" }))
    const input = within(meta).getByRole("textbox", { name: "Version" })
    await user.clear(input)
    await user.type(input, "2.0")
    await user.tab()

    await waitFor(async () => {
      // Stored under the new key; the old key is gone.
      expect(await loadMig("EPC Guide:2.0")).toMatchObject({ version: "2.0" })
    })
    expect(await loadMig("EPC Guide:1.0")).toBeNull()
    // The child's parentMIG followed the re-key, and the route points at it.
    expect((await loadMig("Child:1"))?.parentMIG).toBe("EPC Guide:2.0")
    expect(window.location.hash).toBe("#mig/EPC%20Guide%3A2.0")
  })

  it("renames the MIG from the header title, repointing children and re-routing", async () => {
    const user = userEvent.setup()
    const child: MessageImplementationGuide = {
      name: "Child",
      version: "1",
      messageIdentifier: "pacs.008.001.10",
      parentMIG: "EPC Guide:1.0",
      elementOverrides: {},
    }
    await saveMig(MIG)
    await saveMig(child)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    await user.click(screen.getByRole("button", { name: "Edit MIG name" }))
    const input = screen.getByRole("textbox", { name: "MIG name" })
    await user.clear(input)
    await user.type(input, "Header Renamed")
    await user.tab()

    await waitFor(async () => {
      expect(await loadMig("Header Renamed:1.0")).toMatchObject({ name: "Header Renamed" })
    })
    expect(await loadMig("EPC Guide:1.0")).toBeNull()
    expect((await loadMig("Child:1"))?.parentMIG).toBe("Header Renamed:1.0")
    expect(window.location.hash).toBe("#mig/Header%20Renamed%3A1.0")
  })

  it("surfaces a header rename collision inline", async () => {
    const user = userEvent.setup()
    const taken: MessageImplementationGuide = {
      name: "Taken",
      version: "1.0",
      messageIdentifier: "pacs.008.001.10",
      elementOverrides: {},
    }
    await saveMig(MIG)
    await saveMig(taken)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    await user.click(screen.getByRole("button", { name: "Edit MIG name" }))
    const input = screen.getByRole("textbox", { name: "MIG name" })
    await user.clear(input)
    await user.type(input, "Taken")
    await user.tab()

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument()
    expect(await loadMig("EPC Guide:1.0")).toMatchObject({ name: "EPC Guide" })
  })

  it("offers same-message MIGs as parents and autosaves the choice", async () => {
    const user = userEvent.setup()
    const base: MessageImplementationGuide = { ...MIG, name: "Base", description: undefined }
    await saveMig(base)
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })

    // Parent MIG is view-only until the pencil reveals the select.
    await user.click(screen.getByRole("button", { name: /edit parent mig/i }))
    await user.selectOptions(screen.getByRole("combobox", { name: "Parent MIG" }), "Base:1.0")

    const saved = await loadMig(getMigKey(MIG))
    expect(saved?.parentMIG).toBe("Base:1.0")
  })

  it("links the parent MIG name to its page", async () => {
    const parent: MessageImplementationGuide = {
      name: "Base",
      version: "1.0",
      messageIdentifier: "pacs.008.001.10",
      elementOverrides: {},
    }
    const child: MessageImplementationGuide = { ...MIG, parentMIG: getMigKey(parent) }
    await saveMig(parent)
    await saveMig(child)
    render(<MigEditor migKey={getMigKey(child)} repo={REPO} />)
    await screen.findByRole("treeitem", { name: "Document" })
    const meta = screen.getByRole("region", { name: /mig metadata/i })

    const link = within(meta).getByRole("link", { name: "Base 1.0" })
    expect(link).toHaveAttribute("href", "#mig/Base%3A1.0")
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
