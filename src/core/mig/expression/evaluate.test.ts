import { describe, expect, it } from "vitest"
import { parseExpression } from "./parser"
import { evaluateExpression, type EvalNode } from "./evaluate"

/** Terse builder for a parsed-XML node. */
function node(
  localName: string,
  opts: { text?: string; attributes?: Record<string, string>; children?: EvalNode[] } = {},
): EvalNode {
  return {
    localName,
    text: opts.text ?? "",
    attributes: opts.attributes ?? {},
    children: opts.children ?? [],
  }
}

/** Parse `src` and evaluate it against `context`; throws if it doesn't parse. */
function evalOk(src: string, context: EvalNode): boolean {
  const r = parseExpression(src)
  if (!r.ok) throw new Error(`parse failed: ${r.error.message}`)
  const res = evaluateExpression(r.ast, context)
  if (!res.ok) throw new Error(`indeterminate: ${res.reason}`)
  return res.value
}

// <Othr><Id>12345</Id><SchmeNm><Prtry>LGID</Prtry></SchmeNm><Amt Ccy="EUR">9.50</Amt></Othr>
const othr = node("Othr", {
  children: [
    node("Id", { text: "12345" }),
    node("SchmeNm", { children: [node("Prtry", { text: "LGID" })] }),
    node("Amt", { text: "9.50", attributes: { Ccy: "EUR" } }),
  ],
})

describe("evaluateExpression — paths & existence", () => {
  it("treats a present path as true, an absent one as false", () => {
    expect(evalOk("Id", othr)).toBe(true)
    expect(evalOk("Missing", othr)).toBe(false)
    expect(evalOk("not(Missing)", othr)).toBe(true)
  })

  it("resolves nested and attribute paths", () => {
    expect(evalOk("SchmeNm/Prtry = 'LGID'", othr)).toBe(true)
    expect(evalOk("Amt/@Ccy = 'EUR'", othr)).toBe(true)
    expect(evalOk("Amt/@Ccy = 'USD'", othr)).toBe(false)
  })
})

describe("evaluateExpression — comparison", () => {
  it("compares strings by equality", () => {
    expect(evalOk("Id = '12345'", othr)).toBe(true)
    expect(evalOk("Id != '0'", othr)).toBe(true)
  })

  it("compares numerically when both atoms are numeric", () => {
    expect(evalOk("Id > 100", othr)).toBe(true)
    expect(evalOk("Id <= 12345", othr)).toBe(true)
    expect(evalOk("Amt >= 9.5", othr)).toBe(true)
    expect(evalOk("Amt < 9", othr)).toBe(false)
  })

  it("ordering against a non-numeric value is false", () => {
    expect(evalOk("SchmeNm/Prtry > 5", othr)).toBe(false)
  })

  it("a comparison with an empty node-set is false (both = and !=)", () => {
    expect(evalOk("Missing = 'x'", othr)).toBe(false)
    expect(evalOk("Missing != 'x'", othr)).toBe(false)
  })

  it("uses existence semantics across a multi-node set", () => {
    const list = node("List", {
      children: [node("Cd", { text: "A" }), node("Cd", { text: "B" })],
    })
    expect(evalOk("Cd = 'B'", list)).toBe(true) // some node matches
    expect(evalOk("Cd != 'B'", list)).toBe(true) // some node differs (A)
    expect(evalOk("Cd = 'Z'", list)).toBe(false)
  })
})

describe("evaluateExpression — boolean operators", () => {
  it("and / or", () => {
    expect(evalOk("Id and SchmeNm", othr)).toBe(true)
    expect(evalOk("Missing or Id", othr)).toBe(true)
    expect(evalOk("Missing and Id", othr)).toBe(false)
    expect(evalOk("Missing or Absent", othr)).toBe(false)
  })

  it("at-least-one / at-most-one / exactly-one count how many hold", () => {
    // present: Id, SchmeNm, Amt — absent: Missing, Absent
    expect(evalOk("at-least-one(Missing, Id)", othr)).toBe(true) // 1
    expect(evalOk("at-least-one(Missing, Absent)", othr)).toBe(false) // 0

    expect(evalOk("at-most-one(Missing, Absent)", othr)).toBe(true) // 0
    expect(evalOk("at-most-one(Missing, Id)", othr)).toBe(true) // 1
    expect(evalOk("at-most-one(Id, SchmeNm)", othr)).toBe(false) // 2

    expect(evalOk("exactly-one(Missing, Id)", othr)).toBe(true) // 1
    expect(evalOk("exactly-one(Missing, Absent)", othr)).toBe(false) // 0
    expect(evalOk("exactly-one(Id, SchmeNm)", othr)).toBe(false) // 2
  })

  it("cardinality counts a repeating element once (present, not occurrences)", () => {
    const ctx = node("Doc", {
      children: [node("A"), node("A"), node("B", { text: "x" })],
    })
    // A occurs twice but counts as one present field; C is absent.
    expect(evalOk("exactly-one(A, C)", ctx)).toBe(true)
    expect(evalOk("exactly-one(A, B)", ctx)).toBe(false) // both present -> 2
  })

  it("evaluates the motivating example", () => {
    // not(Prtry = 'LGID' or matches(Id, 13 digits)) — Prtry is LGID, so false.
    expect(evalOk("not(SchmeNm/Prtry = 'LGID' or matches(Id, '[0-9]{13}'))", othr)).toBe(false)
    // With a non-matching Prtry and a 5-digit Id, the inner OR is false → not() true.
    const othr2 = node("Othr", {
      children: [node("Id", { text: "12345" }), node("SchmeNm", { children: [node("Prtry", { text: "BBA" })] })],
    })
    expect(evalOk("not(SchmeNm/Prtry = 'LGID' or matches(Id, '[0-9]{13}'))", othr2)).toBe(true)
  })
})

describe("evaluateExpression — functions", () => {
  it("matches() tests the regex anywhere in the value", () => {
    expect(evalOk("matches(Id, '^[0-9]{5}$')", othr)).toBe(true)
    expect(evalOk("matches(Id, '[A-Z]')", othr)).toBe(false)
  })

  it("count() returns the node-set size", () => {
    const list = node("List", { children: [node("Cd"), node("Cd"), node("Cd")] })
    expect(evalOk("count(Cd) = 3", list)).toBe(true)
    expect(evalOk("count(Cd) > 5", list)).toBe(false)
    expect(evalOk("count(Missing) = 0", list)).toBe(true)
  })
})

describe("evaluateExpression — indeterminate", () => {
  it("returns ok:false for an unsupported function", () => {
    const r = parseExpression("contains(Id, '5')")
    if (!r.ok) throw new Error("parse failed")
    expect(evaluateExpression(r.ast, othr)).toEqual({ ok: false, reason: 'Unsupported function "contains"' })
  })

  it("returns ok:false for a bad regex passed through a path", () => {
    const ctx = node("X", { children: [node("Id", { text: "5" }), node("P", { text: "[0-9" })] })
    const r = parseExpression("matches(Id, P)")
    if (!r.ok) throw new Error("parse failed")
    expect(evaluateExpression(r.ast, ctx).ok).toBe(false)
  })
})
