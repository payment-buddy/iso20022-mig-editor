import { describe, expect, it } from "vitest"
import { shortCodeForIdentifier } from "./messageIdentifier"

describe("shortCodeForIdentifier", () => {
  it("takes the first two dot-segments of a full identifier", () => {
    expect(shortCodeForIdentifier("pacs.008.001.08")).toBe("pacs.008")
    expect(shortCodeForIdentifier("camt.053.001.10")).toBe("camt.053")
  })

  it("matches across flavours/versions of one family", () => {
    expect(shortCodeForIdentifier("pacs.008.001.08")).toBe(
      shortCodeForIdentifier("pacs.008.001.09")
    )
  })

  it("distinguishes different families", () => {
    expect(shortCodeForIdentifier("pacs.008.001.08")).not.toBe(
      shortCodeForIdentifier("pacs.009.001.08")
    )
  })

  it("returns short or empty inputs unchanged", () => {
    expect(shortCodeForIdentifier("pacs")).toBe("pacs")
    expect(shortCodeForIdentifier("")).toBe("")
  })
})
