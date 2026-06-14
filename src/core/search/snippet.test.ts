import { describe, expect, it } from "vitest"
import { makeSnippet } from "./snippet"

describe("makeSnippet", () => {
  it("splits around the first case-insensitive match, preserving casing", () => {
    const s = makeSnippet("The Debtor Party name", "debtor")
    expect(s).toEqual({ before: "The ", match: "Debtor", after: " Party name" })
  })

  it("clips with ellipses when the match is deep inside a long value", () => {
    const value = "x".repeat(100) + "NEEDLE" + "y".repeat(100)
    const s = makeSnippet(value, "needle")
    expect(s.match).toBe("NEEDLE")
    expect(s.before.startsWith("…")).toBe(true)
    expect(s.after.endsWith("…")).toBe(true)
  })

  it("returns a clipped head with no match for a blank query", () => {
    const s = makeSnippet("hello world", "")
    expect(s.match).toBe("")
    expect(s.before).toBe("hello world")
  })

  it("highlights only the trimmed word for an edge-space (boundary) query", () => {
    // Trailing-space query anchors the end of a value with no trailing space.
    expect(makeSnippet("Amount", "amount ")).toEqual({
      before: "",
      match: "Amount",
      after: "",
    })
    // Mid-value boundary match still highlights just the word, not the space.
    expect(makeSnippet("Total amount due", "amount ")).toEqual({
      before: "Total ",
      match: "amount",
      after: " due",
    })
    // Both-edge query against a standalone word.
    expect(makeSnippet("Amount", " amount ")).toEqual({
      before: "",
      match: "Amount",
      after: "",
    })
  })
})
