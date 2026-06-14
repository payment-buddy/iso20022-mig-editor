// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { parseMessageXml } from "./parseMessageXml"

describe("parseMessageXml", () => {
  it("builds an InstanceNode tree, stripping namespaces", () => {
    const xml = `<?xml version="1.0"?>
      <Document xmlns="urn:iso:std:iso:20022">
        <GrpHdr><CreDtTm>2024-01-01</CreDtTm></GrpHdr>
        <Amt Ccy="EUR">100</Amt>
      </Document>`
    const result = parseMessageXml(xml)
    if ("error" in result) throw new Error(result.error)
    expect(result.root.localName).toBe("Document")
    expect(result.root.children.map((c) => c.localName)).toEqual([
      "GrpHdr",
      "Amt",
    ])
    const amt = result.root.children[1]
    expect(amt.text.trim()).toBe("100")
    expect(amt.attributes).toEqual({ Ccy: "EUR" }) // xmlns excluded
    expect(result.root.children[0].children[0]).toMatchObject({
      localName: "CreDtTm",
      text: "2024-01-01",
    })
  })

  it("reports malformed XML as an error", () => {
    const result = parseMessageXml("<Document><GrpHdr></Document>")
    expect("error" in result).toBe(true)
  })
})
