// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ERepository, MessageDefinition, MessageElement } from "@/core/types/types"
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

function message(name: string, identifier: string, root: MessageElement): MessageDefinition {
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
            elements: [
              el("GrpHdr"),
              el("CdtTrfTxInf", { elements: [el("Amt")] }),
            ],
          }),
        ),
      ],
    },
  ],
}

afterEach(cleanup)

describe("MessageExplorer", () => {
  it("shows the header, identifier and root definition", () => {
    render(<MessageExplorer repo={REPO} code="pacs.008.001.10" />)
    expect(screen.getByRole("heading", { name: "CreditTransferV10" })).toBeInTheDocument()
    expect(screen.getByText("pacs.008.001.10")).toBeInTheDocument()
    expect(screen.getByText("The credit transfer message.")).toBeInTheDocument()
  })

  it("renders version pills with the current one marked", () => {
    render(<MessageExplorer repo={REPO} code="pacs.008.001.10" />)
    expect(screen.getByRole("link", { name: "08" })).toHaveAttribute("href", "#pacs.008.001.08")
    expect(screen.getByRole("link", { name: "10" })).toHaveAttribute("aria-current", "page")
  })

  it("expands a node and reveals nested elements via its caret", async () => {
    render(<MessageExplorer repo={REPO} code="pacs.008.001.10" />)
    // root expanded by default
    expect(screen.getByText("GrpHdr")).toBeInTheDocument()
    expect(screen.getByText("CdtTrfTxInf")).toBeInTheDocument()
    // grandchild hidden until its parent is expanded
    expect(screen.queryByText("Amt")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /expand CdtTrfTxInf/i }))
    expect(screen.getByText("Amt")).toBeInTheDocument()
  })

  it("shows the root element in the detail panel by default", () => {
    render(<MessageExplorer repo={REPO} code="pacs.008.001.10" />)
    const panel = screen.getByRole("region", { name: /element details/i })
    expect(within(panel).getByText("Document")).toBeInTheDocument()
    expect(within(panel).getByText("The credit transfer message.")).toBeInTheDocument()
  })

  it("shows the clicked element's path in the detail panel", async () => {
    render(<MessageExplorer repo={REPO} code="pacs.008.001.10" />)
    await userEvent.click(screen.getByRole("button", { name: "CdtTrfTxInf" }))

    const panel = screen.getByRole("region", { name: /element details/i })
    expect(within(panel).getByText("DocumentTag/CdtTrfTxInfTag")).toBeInTheDocument()
  })

  it("opens the Create MIG dialog from the header", async () => {
    render(<MessageExplorer repo={REPO} code="pacs.008.001.10" />)
    await userEvent.click(screen.getByRole("button", { name: /create mig/i }))
    expect(screen.getByRole("dialog", { name: /new message implementation guide/i })).toBeInTheDocument()
  })

  it("shows a not-found state for an unknown code", () => {
    render(<MessageExplorer repo={REPO} code="nope.999" />)
    expect(screen.getByRole("heading", { name: /message not found/i })).toBeInTheDocument()
  })
})
