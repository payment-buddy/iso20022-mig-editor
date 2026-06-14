// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type {
  ERepository,
  MessageDefinition,
  MessageElement,
} from "@/core/types/types"
import { MessageExplorer } from "./MessageExplorer"

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

function message(
  name: string,
  identifier: string,
  root: MessageElement
): MessageDefinition {
  return { name, identifier, shortCode: "pacs.008", rootElement: root }
}

const REPO: ERepository = {
  businessAreas: [
    {
      name: "Payments Clearing",
      code: "pacs",
      definition: "",
      messages: [
        message("CreditTransferV08", "pacs.008.001.08", el("Document")),
        message(
          "CreditTransferV10",
          "pacs.008.001.10",
          el("Document", {
            definition: "The credit transfer message.",
            constraints: [
              {
                name: "SupplementaryDataRule",
                definition: "Must not be empty.",
                expression: "GrpHdr/MsgId",
                isoExpression: "<RuleDefinition>raw</RuleDefinition>",
              },
            ],
            elements: [
              el("GrpHdr"),
              el("CdtTrfTxInf", { elements: [el("Amt")] }),
              el("Reserved", { maxOccurs: 0 }),
            ],
          })
        ),
      ],
    },
  ],
}

afterEach(cleanup)

describe("MessageExplorer", () => {
  it("shows the header, identifier and root definition", () => {
    render(<MessageExplorer repo={REPO} code="pacs.008.001.10" />)
    expect(
      screen.getByRole("heading", { name: "CreditTransferV10" })
    ).toBeInTheDocument()
    expect(screen.getByText("pacs.008.001.10")).toBeInTheDocument()
    expect(screen.getByText("The credit transfer message.")).toBeInTheDocument()
  })

  it("renders version pills with the current one marked", () => {
    render(<MessageExplorer repo={REPO} code="pacs.008.001.10" />)
    expect(screen.getByRole("link", { name: "08" })).toHaveAttribute(
      "href",
      "#pacs.008.001.08"
    )
    expect(screen.getByRole("link", { name: "10" })).toHaveAttribute(
      "aria-current",
      "page"
    )
  })

  it("expands a node and reveals nested elements via its caret", async () => {
    render(<MessageExplorer repo={REPO} code="pacs.008.001.10" />)
    // root expanded by default
    expect(screen.getByRole("treeitem", { name: "GrpHdr" })).toBeInTheDocument()
    expect(
      screen.getByRole("treeitem", { name: "CdtTrfTxInf" })
    ).toBeInTheDocument()
    // grandchild hidden until its parent is expanded
    expect(
      screen.queryByRole("treeitem", { name: "Amt" })
    ).not.toBeInTheDocument()

    // Caret toggle (mouse): click the caret inside the node.
    const node = screen.getByRole("treeitem", { name: "CdtTrfTxInf" })
    await userEvent.click(
      node.querySelector("[role='presentation']") as HTMLElement
    )
    expect(screen.getByRole("treeitem", { name: "Amt" })).toBeInTheDocument()
  })

  it("shows the root element in the detail panel by default", () => {
    render(<MessageExplorer repo={REPO} code="pacs.008.001.10" />)
    const panel = screen.getByRole("region", { name: /element details/i })
    expect(within(panel).getByText("Document")).toBeInTheDocument()
    expect(
      within(panel).getByText("The credit transfer message.")
    ).toBeInTheDocument()
  })

  it("shows the clicked element's path in the detail panel (selection follows focus)", async () => {
    render(<MessageExplorer repo={REPO} code="pacs.008.001.10" />)
    await userEvent.click(screen.getByRole("treeitem", { name: "CdtTrfTxInf" }))

    const panel = screen.getByRole("region", { name: /element details/i })
    expect(
      within(panel).getByText("/DocumentTag/CdtTrfTxInfTag")
    ).toBeInTheDocument()
  })

  it("toggles tree labels between element names and XML tags", async () => {
    render(<MessageExplorer repo={REPO} code="pacs.008.001.10" />)
    expect(screen.getByRole("treeitem", { name: "GrpHdr" })).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText("Show XML tags"))
    expect(
      screen.getByRole("treeitem", { name: "GrpHdrTag" })
    ).toBeInTheDocument()
  })

  it("lists element constraints as nodes and shows their detail", async () => {
    render(<MessageExplorer repo={REPO} code="pacs.008.001.10" />)
    // root constraint is visible (root expanded by default)
    const node = screen.getByRole("treeitem", {
      name: /constraint SupplementaryDataRule/i,
    })
    await userEvent.click(node)

    const panel = screen.getByRole("region", { name: /constraint details/i })
    expect(within(panel).getByText("Must not be empty.")).toBeInTheDocument()
    // The XML path points at the element that owns the rule, not the rule path.
    expect(within(panel).getByText("/DocumentTag")).toBeInTheDocument()
    // The derived DSL expression and the raw ISO expression are both shown.
    expect(within(panel).getByText("GrpHdr/MsgId")).toBeInTheDocument()
    expect(
      within(panel).getByText("<RuleDefinition>raw</RuleDefinition>")
    ).toBeInTheDocument()
  })

  it("navigates the tree with arrow keys, expanding and selecting (selection follows focus)", async () => {
    const user = userEvent.setup()
    render(<MessageExplorer repo={REPO} code="pacs.008.001.10" />)
    const panel = screen.getByRole("region", { name: /element details/i })

    // Focus the root (Document); it is the tree's single tab-stop.
    await user.click(screen.getByRole("treeitem", { name: "Document" }))
    expect(screen.getByRole("treeitem", { name: "Document" })).toHaveFocus()

    // ↓ moves to the first child and the detail panel follows.
    await user.keyboard("{ArrowDown}")
    expect(screen.getByRole("treeitem", { name: "GrpHdr" })).toHaveFocus()
    expect(
      within(panel).getByText("/DocumentTag/GrpHdrTag")
    ).toBeInTheDocument()

    // ↓ to CdtTrfTxInf, → expands it, → again steps into its first child.
    await user.keyboard("{ArrowDown}")
    expect(screen.getByRole("treeitem", { name: "CdtTrfTxInf" })).toHaveFocus()
    await user.keyboard("{ArrowRight}")
    expect(
      screen.getByRole("treeitem", { name: "CdtTrfTxInf" })
    ).toHaveAttribute("aria-expanded", "true")
    await user.keyboard("{ArrowRight}")
    expect(screen.getByRole("treeitem", { name: "Amt" })).toHaveFocus()

    // ← from a leaf returns to the parent; ← again collapses it.
    await user.keyboard("{ArrowLeft}")
    expect(screen.getByRole("treeitem", { name: "CdtTrfTxInf" })).toHaveFocus()
    await user.keyboard("{ArrowLeft}")
    expect(
      screen.queryByRole("treeitem", { name: "Amt" })
    ).not.toBeInTheDocument()
  })

  it("toggles expansion with Space and jumps with Home/End", async () => {
    const user = userEvent.setup()
    render(<MessageExplorer repo={REPO} code="pacs.008.001.10" />)

    const root = screen.getByRole("treeitem", { name: "Document" })
    await user.click(root)
    expect(root).toHaveFocus()

    // Space collapses the root, hiding its children.
    await user.keyboard(" ")
    expect(root).toHaveAttribute("aria-expanded", "false")
    expect(
      screen.queryByRole("treeitem", { name: "GrpHdr" })
    ).not.toBeInTheDocument()

    // Space again re-expands; End jumps to the last visible node.
    await user.keyboard(" ")
    await user.keyboard("{End}")
    expect(
      screen.getByRole("treeitem", {
        name: /constraint SupplementaryDataRule/i,
      })
    ).toHaveFocus()

    // Home returns to the root.
    await user.keyboard("{Home}")
    expect(root).toHaveFocus()
  })

  it("expands an entire subtree with '*'", async () => {
    const user = userEvent.setup()
    render(<MessageExplorer repo={REPO} code="pacs.008.001.10" />)

    await user.click(screen.getByRole("treeitem", { name: "Document" }))
    // Deep grandchild hidden until the whole subtree is expanded.
    expect(
      screen.queryByRole("treeitem", { name: "Amt" })
    ).not.toBeInTheDocument()
    await user.keyboard("*")
    expect(screen.getByRole("treeitem", { name: "Amt" })).toBeInTheDocument()
  })

  it("filters the tree to matches plus their ancestors and auto-expands", async () => {
    const user = userEvent.setup()
    render(<MessageExplorer repo={REPO} code="pacs.008.001.10" />)

    // Amt is a collapsed grandchild; typing reveals it with its ancestor chain
    // (CdtTrfTxInf) auto-expanded, while non-matching siblings are pruned.
    expect(
      screen.queryByRole("treeitem", { name: "Amt" })
    ).not.toBeInTheDocument()
    await user.type(
      screen.getByLabelText("Filter elements and constraints"),
      "Amt"
    )

    expect(screen.getByRole("treeitem", { name: "Amt" })).toBeInTheDocument()
    expect(
      screen.getByRole("treeitem", { name: "CdtTrfTxInf" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("treeitem", { name: "Document" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("treeitem", { name: "GrpHdr" })
    ).not.toBeInTheDocument()
  })

  it("keeps matching constraints and shows a no-matches message", async () => {
    const user = userEvent.setup()
    render(<MessageExplorer repo={REPO} code="pacs.008.001.10" />)
    const box = screen.getByLabelText("Filter elements and constraints")

    await user.type(box, "SupplementaryData")
    expect(
      screen.getByRole("treeitem", {
        name: /constraint SupplementaryDataRule/i,
      })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("treeitem", { name: "GrpHdr" })
    ).not.toBeInTheDocument()

    await user.clear(box)
    await user.type(box, "zzz-no-such-node")
    expect(screen.queryByRole("tree")).not.toBeInTheDocument()
    expect(
      screen.getByText(/no elements or constraints match/i)
    ).toBeInTheDocument()
  })

  it("focuses the filter box with '/'", async () => {
    const user = userEvent.setup()
    render(<MessageExplorer repo={REPO} code="pacs.008.001.10" />)

    await user.click(screen.getByRole("treeitem", { name: "Document" }))
    await user.keyboard("/")
    expect(
      screen.getByLabelText("Filter elements and constraints")
    ).toHaveFocus()
  })

  it("hides maxOccurs:0 elements when 'Hide excluded' is toggled on", async () => {
    const user = userEvent.setup()
    render(<MessageExplorer repo={REPO} code="pacs.008.001.10" />)

    // Excluded elements show by default, marked, and the toggle counts them.
    const reserved = screen.getByRole("treeitem", { name: "Reserved" })
    expect(within(reserved).getByText("excluded")).toBeInTheDocument()
    const toggle = screen.getByLabelText(/hide excluded \(1\)/i)

    await user.click(toggle)
    expect(
      screen.queryByRole("treeitem", { name: "Reserved" })
    ).not.toBeInTheDocument()

    await user.click(toggle)
    expect(
      screen.getByRole("treeitem", { name: "Reserved" })
    ).toBeInTheDocument()
  })

  it("disables 'Hide excluded' when nothing is excluded", () => {
    render(<MessageExplorer repo={REPO} code="pacs.008.001.08" />)
    expect(screen.getByLabelText(/hide excluded \(0\)/i)).toBeDisabled()
  })

  it("opens the Create MIG dialog from the header", async () => {
    render(<MessageExplorer repo={REPO} code="pacs.008.001.10" />)
    await userEvent.click(screen.getByRole("button", { name: /create mig/i }))
    expect(
      screen.getByRole("dialog", { name: /new message implementation guide/i })
    ).toBeInTheDocument()
  })

  it("shows a not-found state for an unknown code", () => {
    render(<MessageExplorer repo={REPO} code="nope.999" />)
    expect(
      screen.getByRole("heading", { name: /message not found/i })
    ).toBeInTheDocument()
  })
})
