import { describe, expect, it } from "vitest"
import type { ERepository, MessageDefinition } from "@/core/types/types"
import { resolveMessage } from "./resolveMessage"

function msg(name: string, shortCode: string, identifier: string): MessageDefinition {
  return { name, shortCode, identifier, rootElement: {} as MessageDefinition["rootElement"] }
}

const REPO: ERepository = {
  businessAreas: [
    {
      name: "Payments Clearing",
      code: "pacs",
      definition: "",
      messages: [
        msg("CreditTransferV08", "pacs.008", "pacs.008.001.08"),
        msg("CreditTransferV10", "pacs.008", "pacs.008.001.10"),
        msg("PaymentStatusV12", "pacs.002", "pacs.002.001.12"),
      ],
    },
  ],
}

describe("resolveMessage", () => {
  it("resolves an exact identifier to that version", () => {
    const r = resolveMessage(REPO, "pacs.008.001.08")!
    expect(r.current.identifier).toBe("pacs.008.001.08")
    expect(r.versions.map((v) => v.identifier)).toEqual(["pacs.008.001.08", "pacs.008.001.10"])
  })

  it("resolves a shortCode to the latest version", () => {
    const r = resolveMessage(REPO, "pacs.008")!
    expect(r.current.identifier).toBe("pacs.008.001.10")
  })

  it("returns null for an unknown code", () => {
    expect(resolveMessage(REPO, "nope.999")).toBeNull()
  })
})
