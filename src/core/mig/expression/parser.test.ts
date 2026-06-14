import { describe, expect, it } from "vitest"
import type { Binary, Compare, ExprNode, Path } from "./ast"
import { parseExpression } from "./parser"
import { validateExpressionSyntax } from "./index"

/** Parse and assert success, returning the AST. */
function ast(src: string): ExprNode {
  const r = parseExpression(src)
  if (!r.ok) throw new Error(`expected ${JSON.stringify(src)} to parse, got: ${r.error.message}`)
  return r.ast
}

/** Parse and assert failure, returning the error. */
function err(src: string) {
  const r = parseExpression(src)
  if (r.ok) throw new Error(`expected ${JSON.stringify(src)} to fail, but it parsed`)
  return r.error
}

describe("parseExpression — valid", () => {
  it("parses the motivating example", () => {
    const r = parseExpression("not(SchmeNm/Prtry = 'LGID' or matches(Id, '[0-9]{13}'))")
    expect(r.ok).toBe(true)
  })

  it("parses a multi-step path with an attribute step", () => {
    const node = ast("Amt/@Ccy") as Path
    expect(node.kind).toBe("path")
    expect(node.steps).toEqual([
      { name: "Amt", isAttribute: false },
      { name: "Ccy", isAttribute: true },
    ])
  })

  it("rejects an absolute (leading-'/') path — all paths are relative", () => {
    expect(parseExpression("/Document/Amt").ok).toBe(false)
    expect(parseExpression("count(/Amt)").ok).toBe(false)
  })

  it("nests precedence or < and < comparison", () => {
    // a or b and c  ->  a or (b and c)
    const node = ast("a or b and c") as Binary
    expect(node.op).toBe("or")
    expect((node.right as Binary).op).toBe("and")
  })

  it("binds comparison tighter than and", () => {
    // a = b and c = d  ->  (a = b) and (c = d)
    const node = ast("a = b and c = d") as Binary
    expect(node.op).toBe("and")
    expect((node.left as Compare).op).toBe("=")
    expect((node.right as Compare).op).toBe("=")
  })

  it("accepts all comparison operators against literals", () => {
    for (const op of ["=", "!=", "<", "<=", ">", ">="]) {
      expect(parseExpression(`Amt ${op} 100`).ok).toBe(true)
    }
  })

  it("lets parentheses override precedence", () => {
    const node = ast("(a or b) and c") as Binary
    expect(node.op).toBe("and")
    expect((node.left as Binary).op).toBe("or")
  })

  it("accepts arbitrary function names with any arity", () => {
    expect(parseExpression("contains(Ustrd, 'MANDATE')").ok).toBe(true)
    expect(parseExpression("currentDate()").ok).toBe(true)
    expect(parseExpression("sum(a, b, c, d)").ok).toBe(true)
  })

  it("accepts not() of a path (existence) and of a comparison", () => {
    expect(parseExpression("not(Amt)").ok).toBe(true)
    expect(parseExpression("not(Amt = 0)").ok).toBe(true)
  })
})

describe("parseExpression — syntax errors", () => {
  it("rejects an empty / blank expression", () => {
    expect(parseExpression("").ok).toBe(false)
    expect(parseExpression("   ").ok).toBe(false)
  })

  it("rejects unbalanced parentheses", () => {
    expect(err("not(A = 1").message).toMatch(/Expected "\)"/)
  })

  it("rejects trailing input", () => {
    expect(err("A = 1 B").message).toMatch(/trailing/)
  })

  it("rejects a chained comparison", () => {
    expect(err("a = b = c").message).toMatch(/chained/)
  })

  it("rejects a dangling operator", () => {
    expect(err("A and").message).toMatch(/Expected an expression/)
  })

  it("rejects a leading keyword", () => {
    expect(err("and A").message).toMatch(/keyword/)
  })

  it("reports the position of the error", () => {
    const e = err("A = ")
    expect(e.start).toBe(3) // just past the '=' token (trailing space isn't tokenized)
  })
})

describe("parseExpression — function argument checks", () => {
  it("rejects not() with the wrong arity", () => {
    expect(err("not(A, B)").message).toMatch(/not\(\) takes exactly one/)
    expect(err("not()").message).toMatch(/not\(\) takes exactly one/)
  })

  it("rejects not() of a bare literal", () => {
    expect(err("not('x')").message).toMatch(/boolean/)
    expect(err("not(5)").message).toMatch(/boolean/)
  })

  it("rejects matches() with the wrong arity", () => {
    expect(err("matches(Id)").message).toMatch(/two arguments/)
    expect(err("matches(Id, 'a', 'b')").message).toMatch(/two arguments/)
  })

  it("rejects a boolean first argument to matches()", () => {
    expect(err("matches(a = b, '[0-9]+')").message).toMatch(/string value/)
  })

  it("rejects an invalid regex literal in matches()", () => {
    expect(err("matches(Id, '[0-9')").message).toMatch(/regular expression/)
  })

  it("rejects a non-string pattern in matches()", () => {
    expect(err("matches(Id, 5)").message).toMatch(/must be a string/)
  })

  it("accepts a path or other call as the matches() pattern (can't check statically)", () => {
    expect(parseExpression("matches(Id, Pattern)").ok).toBe(true)
    expect(parseExpression("matches(Id, upper(P))").ok).toBe(true)
  })

  it("accepts count() of a path and uses it as a number", () => {
    expect(parseExpression("count(Document/Amt) > 0").ok).toBe(true)
    expect(parseExpression("count(SchmeNm/Prtry) = 1").ok).toBe(true)
    expect(parseExpression("count(@Ccy)").ok).toBe(true)
  })

  it("rejects count() with the wrong arity", () => {
    expect(err("count(A, B)").message).toMatch(/count\(\) takes exactly one/)
    expect(err("count()").message).toMatch(/count\(\) takes exactly one/)
  })

  it("rejects a non-path argument to count()", () => {
    expect(err("count('x')").message).toMatch(/path expression/)
    expect(err("count(5)").message).toMatch(/path expression/)
    expect(err("count(a = b)").message).toMatch(/path expression/)
  })

  it("accepts the presence-cardinality functions with two or more arguments", () => {
    expect(parseExpression("at-least-one(A, B)").ok).toBe(true)
    expect(parseExpression("at-most-one(A, B, C)").ok).toBe(true)
    expect(parseExpression("exactly-one(A, B/C, D = 'x')").ok).toBe(true)
  })

  it("rejects a presence-cardinality function with fewer than two arguments", () => {
    expect(err("exactly-one(A)").message).toMatch(/at least two/)
    expect(err("at-most-one()").message).toMatch(/at least two/)
  })

  it("rejects a bare literal argument to a presence-cardinality function", () => {
    expect(err("exactly-one(A, 'x')").message).toMatch(/not literals/)
    expect(err("at-least-one(A, 5)").message).toMatch(/not literals/)
  })

  it("accepts all-equal() of a path; rejects wrong arity or a literal", () => {
    expect(parseExpression("all-equal(Item/Amount/@Ccy)").ok).toBe(true)
    expect(err("all-equal(A, B)").message).toMatch(/all-equal\(\) takes exactly one/)
    expect(err("all-equal('x')").message).toMatch(/all-equal\(\) expects a path/)
  })

  it("treats a presence-cardinality call as boolean (so count() rejects it)", () => {
    expect(err("count(exactly-one(A, B))").message).toMatch(/path expression/)
    expect(parseExpression("not(at-most-one(A, B))").ok).toBe(true)
  })
})

describe("validateExpressionSyntax", () => {
  it("returns null for empty and valid input", () => {
    expect(validateExpressionSyntax("")).toBeNull()
    expect(validateExpressionSyntax("  ")).toBeNull()
    expect(validateExpressionSyntax("not(Amt = 0)")).toBeNull()
  })

  it("returns a one-line message with a 1-based position", () => {
    expect(validateExpressionSyntax("not(A = 1")).toMatch(/Expected "\)" \(at position \d+\)/)
  })
})
