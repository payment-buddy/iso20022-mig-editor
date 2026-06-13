import { describe, expect, it } from "vitest"
import { ExprSyntaxError, tokenize, type Token } from "./lexer"

const types = (src: string) => tokenize(src).map((t) => t.type)
const values = (src: string) => tokenize(src).map((t) => t.value)

describe("tokenize", () => {
  it("classifies names, keywords, operators and literals", () => {
    const toks = tokenize("not(A and B or 'x' != 12)")
    expect(toks.map((t: Token) => [t.type, t.value])).toEqual([
      ["name", "not"],
      ["op", "("],
      ["name", "A"],
      ["kw", "and"],
      ["name", "B"],
      ["kw", "or"],
      ["string", "x"],
      ["op", "!="],
      ["number", "12"],
      ["op", ")"],
    ])
  })

  it("treats only and/or/xor as keywords", () => {
    expect(types("matches xor contains")).toEqual(["name", "kw", "name"])
  })

  it("reads multi-character comparison operators greedily", () => {
    expect(values("a <= b >= c != d < e")).toEqual(["a", "<=", "b", ">=", "c", "!=", "d", "<", "e"])
  })

  it("keeps the attribute marker on the name token", () => {
    const toks = tokenize("@Ccy")
    expect(toks[0]).toMatchObject({ type: "name", value: "@Ccy" })
  })

  it("unescapes a doubled quote inside a string", () => {
    const toks = tokenize("'O''Brien'")
    expect(toks[0]).toMatchObject({ type: "string", value: "O'Brien" })
  })

  it("reads a decimal number with digits on both sides of the dot", () => {
    expect(values("3.14")).toEqual(["3.14"])
  })

  it("records source offsets", () => {
    const toks = tokenize("A = 'b'")
    expect(toks[2]).toMatchObject({ type: "string", value: "b", start: 4, end: 7 })
  })

  it("throws on an unterminated string", () => {
    expect(() => tokenize("'oops")).toThrow(ExprSyntaxError)
  })

  it("throws on a bare @", () => {
    expect(() => tokenize("@ ")).toThrow(/attribute name/)
  })

  it("throws on an illegal character", () => {
    expect(() => tokenize("A & B")).toThrow(/Unexpected character/)
  })
})
