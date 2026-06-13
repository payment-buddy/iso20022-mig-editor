// @vitest-environment jsdom
import "fake-indexeddb/auto"
import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { deleteDatabase } from "@/core/storage/db"
import { saveMig } from "@/core/storage/migStore"
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

  it("shows an empty detail panel (no inline editing yet)", async () => {
    await saveMig(MIG)
    render(<MigEditor migKey={getMigKey(MIG)} repo={REPO} />)

    await screen.findByRole("treeitem", { name: "Document" })
    const panel = screen.getByRole("region", { name: /element details/i })
    expect(panel).toHaveTextContent(/inline editing lands/i)
  })

  it("shows a not-found state when the MIG is absent", async () => {
    render(<MigEditor migKey="Ghost:9.9" repo={REPO} />)
    expect(await screen.findByRole("heading", { name: /mig not found/i })).toBeInTheDocument()
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
