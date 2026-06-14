// @vitest-environment jsdom
import "fake-indexeddb/auto"
import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { deleteDatabase } from "@/core/storage/db"
import { saveMig } from "@/core/storage/migStore"
import type {
  BusinessArea,
  ERepository,
  MessageDefinition,
} from "@/core/types/types"
import { ERepositoryBrowser } from "./ERepositoryBrowser"

function msg(
  name: string,
  shortCode: string,
  identifier: string
): MessageDefinition {
  return {
    name,
    shortCode,
    identifier,
    rootElement: {} as MessageDefinition["rootElement"],
  }
}

function area(
  name: string,
  code: string,
  messages: MessageDefinition[]
): BusinessArea {
  return { name, code, definition: "", messages }
}

const REPO: ERepository = {
  businessAreas: [
    area("Payments Clearing", "pacs", [
      msg("CreditTransferV08", "pacs.008", "pacs.008.001.08"),
      msg("CreditTransferV10", "pacs.008", "pacs.008.001.10"),
      msg("PaymentStatusV12", "pacs.002", "pacs.002.001.12"),
    ]),
    area("Cash Management", "camt", [
      msg("BankStatementV09", "camt.053", "camt.053.001.09"),
    ]),
  ],
  messageSets: [
    {
      name: "Credit Transfer Scheme",
      definition: "A scheme for credit transfers.",
      messageIdentifiers: ["pacs.008.001.08", "pacs.002.001.12"],
    },
    {
      name: "Reporting",
      definition: "",
      messageIdentifiers: ["camt.053.001.09"],
    },
  ],
}

afterEach(async () => {
  cleanup()
  await deleteDatabase()
})

describe("ERepositoryBrowser", () => {
  it("lists business areas collapsed, then reveals messages on click", async () => {
    render(<ERepositoryBrowser repo={REPO} onUpdateRepository={vi.fn()} />)

    expect(screen.getByText("Payments Clearing")).toBeInTheDocument()
    // pacs has two groups: pacs.002 and pacs.008
    const pacs = screen
      .getByText("Payments Clearing")
      .closest("[role=treeitem]")!
    expect(pacs).toHaveAttribute("aria-expanded", "false")

    await userEvent.click(screen.getByText("Payments Clearing"))
    expect(pacs).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("treeitem", { name: /pacs\.008/ })).toHaveAttribute(
      "href",
      "#pacs.008"
    )
  })

  it("keeps collapsed groups in the DOM with hidden='until-found' for native find", () => {
    const { container } = render(
      <ERepositoryBrowser repo={REPO} onUpdateRepository={vi.fn()} />
    )
    const group = container.querySelector("ul[role=group]")!
    expect(group).toHaveAttribute("hidden", "until-found")
    // children present even while collapsed (so Ctrl-F can locate them)
    expect(
      within(group as HTMLElement).getByText("CreditTransfer")
    ).toBeInTheDocument()
  })

  it("filters to matching messages and force-expands their area", async () => {
    render(<ERepositoryBrowser repo={REPO} onUpdateRepository={vi.fn()} />)
    await userEvent.type(screen.getByRole("searchbox"), "camt.053")

    expect(
      screen.getByRole("treeitem", { name: /camt\.053/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("treeitem", { name: /pacs\.008/ })
    ).not.toBeInTheDocument()
  })

  it("navigates the tree with arrow keys (roving tabindex)", async () => {
    render(<ERepositoryBrowser repo={REPO} onUpdateRepository={vi.fn()} />)
    const user = userEvent.setup()

    const camt = screen
      .getByText("Cash Management")
      .closest("[role=treeitem]")! as HTMLElement
    camt.focus()
    expect(camt).toHaveFocus()

    // expand, then arrow into the first child
    await user.keyboard("{ArrowRight}{ArrowRight}")
    expect(screen.getByRole("treeitem", { name: /camt\.053/ })).toHaveFocus()

    // left returns to the parent area
    await user.keyboard("{ArrowLeft}")
    expect(camt).toHaveFocus()
  })

  it("flags groups that already have a MIG", async () => {
    render(
      <ERepositoryBrowser
        repo={REPO}
        onUpdateRepository={vi.fn()}
        migMessageIds={new Set(["pacs.008.001.10"])}
      />
    )
    await userEvent.click(screen.getByText("Payments Clearing"))

    const pacs008 = screen.getByRole("treeitem", { name: /pacs\.008/ })
    expect(within(pacs008).getByText("MIG")).toBeInTheDocument()
  })

  it("loads MIG'd identifiers from storage and flags them when no prop is given", async () => {
    await saveMig({
      name: "EPC",
      version: "1.0",
      messageIdentifier: "pacs.008.001.10",
      elementOverrides: {},
    })

    render(<ERepositoryBrowser repo={REPO} onUpdateRepository={vi.fn()} />)
    await userEvent.click(screen.getByText("Payments Clearing"))

    const pacs008 = screen.getByRole("treeitem", { name: /pacs\.008/ })
    expect(await within(pacs008).findByText("MIG")).toBeInTheDocument()
    // a group without a MIG is not flagged
    expect(
      within(screen.getByRole("treeitem", { name: /pacs\.002/ })).queryByText(
        "MIG"
      )
    ).not.toBeInTheDocument()
  })

  it("invokes onUpdateRepository from the page header action", async () => {
    const onUpdate = vi.fn()
    render(<ERepositoryBrowser repo={REPO} onUpdateRepository={onUpdate} />)
    await userEvent.click(
      screen.getByRole("button", { name: /update e-repository/i })
    )
    expect(onUpdate).toHaveBeenCalledOnce()
  })
})

describe("ERepositoryBrowser — Message Sets tab", () => {
  const openSetsTab = async () => {
    render(<ERepositoryBrowser repo={REPO} onUpdateRepository={vi.fn()} />)
    await userEvent.click(screen.getByRole("tab", { name: /message sets/i }))
  }

  it("lists sets when the tab is selected", async () => {
    render(<ERepositoryBrowser repo={REPO} onUpdateRepository={vi.fn()} />)
    // Business Areas is the default tab.
    expect(screen.getByText("Payments Clearing")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("tab", { name: "Message Sets" }))
    expect(screen.getByText("Credit Transfer Scheme")).toBeInTheDocument()
    expect(screen.getByText("Reporting")).toBeInTheDocument()
    // The business-area tree is no longer rendered.
    expect(screen.queryByText("Payments Clearing")).not.toBeInTheDocument()
  })

  it("expands a set to reveal its member message links", async () => {
    await openSetsTab()
    await userEvent.click(
      screen.getByRole("button", { name: /credit transfer scheme/i })
    )
    expect(
      screen.getByRole("link", { name: /pacs\.008\.001\.08/ })
    ).toHaveAttribute("href", "#pacs.008.001.08")
    expect(
      screen.getByRole("link", { name: /pacs\.002\.001\.12/ })
    ).toBeInTheDocument()
  })

  it("filters sets by a member identifier and auto-expands them", async () => {
    await openSetsTab()
    await userEvent.type(screen.getByRole("searchbox"), "camt.053")
    // Only the Reporting set matches, already expanded to show its member.
    expect(screen.getByText("Reporting")).toBeInTheDocument()
    expect(screen.queryByText("Credit Transfer Scheme")).not.toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /camt\.053\.001\.09/ })
    ).toBeInTheDocument()
  })

  it("flags set members that already have a MIG", async () => {
    render(
      <ERepositoryBrowser
        repo={REPO}
        onUpdateRepository={vi.fn()}
        migMessageIds={new Set(["pacs.008.001.08"])}
      />
    )
    await userEvent.click(screen.getByRole("tab", { name: /message sets/i }))
    await userEvent.click(
      screen.getByRole("button", { name: /credit transfer scheme/i })
    )
    const member = screen.getByRole("link", { name: /pacs\.008\.001\.08/ })
    expect(within(member).getByText("MIG")).toBeInTheDocument()
  })
})
