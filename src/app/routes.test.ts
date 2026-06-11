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

  it("parses trash", () => {
    expect(parseHash("#trash")).toEqual({ name: "trash" })
  })

  it("parses the secret reset route", () => {
    expect(parseHash("#reset")).toEqual({ name: "reset" })
  })

  it("parses a mig key, decoding the colon-version", () => {
    expect(parseHash("#mig/EPC-SCTInst%3A2023")).toEqual({
      name: "mig",
      key: "EPC-SCTInst:2023",
    })
  })

  it("parses a compare pair", () => {
    expect(parseHash("#compare/A%3A1/B%3A2")).toEqual({
      name: "compare",
      a: "A:1",
      b: "B:2",
    })
  })

  it("parses a merge target key", () => {
    expect(parseHash("#merge/EPC%3A1.0")).toEqual({
      name: "merge",
      key: "EPC:1.0",
    })
  })

  it("parses a history target key", () => {
    expect(parseHash("#history/EPC%3A1.0")).toEqual({
      name: "history",
      key: "EPC:1.0",
    })
  })

  it("falls back to home for malformed mig / compare / merge / history", () => {
    expect(parseHash("#mig/")).toEqual({ name: "home" })
    expect(parseHash("#compare/only-one")).toEqual({ name: "home" })
    expect(parseHash("#compare/a/b/c")).toEqual({ name: "home" })
    expect(parseHash("#merge/")).toEqual({ name: "home" })
    expect(parseHash("#history/")).toEqual({ name: "home" })
  })

  it("treats anything else as a message code", () => {
    expect(parseHash("#pacs.008.001.08")).toEqual({
      name: "message",
      code: "pacs.008.001.08",
    })
    expect(parseHash("#FIToFICstmrCdtTrf")).toEqual({
      name: "message",
      code: "FIToFICstmrCdtTrf",
    })
  })

  it("parses a deep-linked select path on message and mig routes", () => {
    expect(
      parseHash("#pacs.008.001.08?path=%2FDocument%2FFIToFICstmrCdtTrf")
    ).toEqual({
      name: "message",
      code: "pacs.008.001.08",
      path: "/Document/FIToFICstmrCdtTrf",
    })
    expect(
      parseHash("#mig/EPC%3A1.0?path=%2FDocument%2FGrpHdr%2FMsgId")
    ).toEqual({
      name: "mig",
      key: "EPC:1.0",
      path: "/Document/GrpHdr/MsgId",
    })
  })
})

describe("hashFor", () => {
  it("serializes each route", () => {
    expect(hashFor({ name: "home" })).toBe("#")
    expect(hashFor({ name: "browse" })).toBe("#browse")
    expect(hashFor({ name: "trash" })).toBe("#trash")
    expect(hashFor({ name: "reset" })).toBe("#reset")
    expect(hashFor({ name: "message", code: "pacs.008.001.08" })).toBe(
      "#pacs.008.001.08"
    )
    expect(hashFor({ name: "mig", key: "EPC-SCTInst:2023" })).toBe(
      "#mig/EPC-SCTInst%3A2023"
    )
    expect(hashFor({ name: "compare", a: "A:1", b: "B:2" })).toBe(
      "#compare/A%3A1/B%3A2"
    )
    expect(hashFor({ name: "merge", key: "EPC:1.0" })).toBe("#merge/EPC%3A1.0")
    expect(hashFor({ name: "history", key: "EPC:1.0" })).toBe(
      "#history/EPC%3A1.0"
    )
  })

  it("appends an encoded ?path= for deep-linked routes", () => {
    expect(
      hashFor({
        name: "message",
        code: "pacs.008.001.08",
        path: "/Document/GrpHdr",
      })
    ).toBe("#pacs.008.001.08?path=%2FDocument%2FGrpHdr")
    expect(
      hashFor({ name: "mig", key: "EPC:1.0", path: "/Document/GrpHdr" })
    ).toBe("#mig/EPC%3A1.0?path=%2FDocument%2FGrpHdr")
  })
})

describe("round-trip", () => {
  const routes: Route[] = [
    { name: "home" },
    { name: "browse" },
    { name: "trash" },
    { name: "reset" },
    { name: "message", code: "pacs.008.001.08" },
    { name: "mig", key: "EPC-SCTInst:2023" },
    { name: "compare", a: "EPC:1.0", b: "CSM:2.0" },
    { name: "merge", key: "EPC:1.0" },
    {
      name: "message",
      code: "pacs.008.001.08",
      path: "/Document/GrpHdr/MsgId",
    },
    { name: "mig", key: "EPC:1.0", path: "/Document/GrpHdr/MsgId" },
  ]

  it("parseHash(hashFor(route)) === route", () => {
    for (const route of routes) {
      expect(parseHash(hashFor(route))).toEqual(route)
    }
  })
})
