import { describe, expect, it } from "vitest"
import type { MessageDefinition } from "@/core/types/types"
import { baseName, groupMessages } from "./messageGroups"

function msg(name: string, shortCode: string, identifier: string): MessageDefinition {
  return { name, shortCode, identifier, rootElement: {} as MessageDefinition["rootElement"] }
}

describe("baseName", () => {
  it("strips a trailing version suffix", () => {
    expect(baseName("FIToFICustomerCreditTransferV08")).toBe("FIToFICustomerCreditTransfer")
    expect(baseName("NoSuffix")).toBe("NoSuffix")
  })
})

describe("groupMessages", () => {
  it("groups by shortCode, sorts versions ascending, groups by shortCode", () => {
    const groups = groupMessages([
      msg("CreditTransferV10", "pacs.008", "pacs.008.001.10"),
      msg("CreditTransferV08", "pacs.008", "pacs.008.001.08"),
      msg("PaymentStatusV12", "pacs.002", "pacs.002.001.12"),
    ])

    expect(groups.map((g) => g.shortCode)).toEqual(["pacs.002", "pacs.008"])

    const cdt = groups.find((g) => g.shortCode === "pacs.008")!
    expect(cdt.label).toBe("CreditTransfer")
    expect(cdt.versions.map((v) => v.identifier)).toEqual([
      "pacs.008.001.08",
      "pacs.008.001.10",
    ])
  })

  it("labels a group from its lowest version's base name", () => {
    const [group] = groupMessages([msg("FooV02", "x.001", "x.001.001.02")])
    expect(group.label).toBe("Foo")
  })
})
