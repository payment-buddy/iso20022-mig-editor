import { describe, expect, it } from "vitest"
import { hashFor, parseHash, type Route } from "./routes"

describe("parseHash", () => {
  it("maps empty / '#' / '/' to home", () => {
    expect(parseHash("")).toEqual({ name: "home" })
    expect(parseHash("#")).toEqual({ name: "home" })
    expect(parseHash("#/")).toEqual({ name: "home" })
  })

  it("parses browse", () => {
    expect(parseHash("#browse")).toEqual({ name: "browse" })
  })

  it("parses a mig key, decoding the colon-version", () => {
    expect(parseHash("#mig/EPC-SCTInst%3A2023")).toEqual({
      name: "mig",
      key: "EPC-SCTInst:2023",
    })
  })

  it("parses a compare pair", () => {
    expect(parseHash("#compare/A%3A1/B%3A2")).toEqual({ name: "compare", a: "A:1", b: "B:2" })
  })

  it("falls back to home for malformed mig / compare", () => {
    expect(parseHash("#mig/")).toEqual({ name: "home" })
    expect(parseHash("#compare/only-one")).toEqual({ name: "home" })
    expect(parseHash("#compare/a/b/c")).toEqual({ name: "home" })
  })

  it("treats anything else as a message code", () => {
    expect(parseHash("#pacs.008.001.08")).toEqual({ name: "message", code: "pacs.008.001.08" })
    expect(parseHash("#FIToFICstmrCdtTrf")).toEqual({
      name: "message",
      code: "FIToFICstmrCdtTrf",
    })
  })
})

describe("hashFor", () => {
  it("serializes each route", () => {
    expect(hashFor({ name: "home" })).toBe("#")
    expect(hashFor({ name: "browse" })).toBe("#browse")
    expect(hashFor({ name: "message", code: "pacs.008.001.08" })).toBe("#pacs.008.001.08")
    expect(hashFor({ name: "mig", key: "EPC-SCTInst:2023" })).toBe("#mig/EPC-SCTInst%3A2023")
    expect(hashFor({ name: "compare", a: "A:1", b: "B:2" })).toBe("#compare/A%3A1/B%3A2")
  })
})

describe("round-trip", () => {
  const routes: Route[] = [
    { name: "home" },
    { name: "browse" },
    { name: "message", code: "pacs.008.001.08" },
    { name: "mig", key: "EPC-SCTInst:2023" },
    { name: "compare", a: "EPC:1.0", b: "CSM:2.0" },
  ]

  it("parseHash(hashFor(route)) === route", () => {
    for (const route of routes) {
      expect(parseHash(hashFor(route))).toEqual(route)
    }
  })
})
