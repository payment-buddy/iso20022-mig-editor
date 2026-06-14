// Recursive-descent precedence parser for the constraint expression grammar.
//
//   Or   := And  ( 'or'  And  )*
//   And  := Cmp  ( 'and' Cmp  )*
//   Cmp  := Prim ( ('=' | '!=' | '<' | '<=' | '>' | '>=') Prim )?   non-associative
//   Prim := Func | '(' Expr ')' | Path | String | Number
//   Func := Name '(' ( Expr (',' Expr)* )? ')'
//   Path := ['/'] Step ( '/' Step )*                                Step: ['@'] Name

import type {
  Binary,
  BinaryOp,
  Call,
  Compare,
  CompareOp,
  ExprNode,
  Path,
  PathStep,
} from "./ast"
import { CARDINALITY_FUNCTIONS, kindOf } from "./ast"
import { ExprSyntaxError, tokenize, type Token } from "./lexer"

export interface ExprError {
  message: string
  start: number
  end: number
}

export type ParseResult = { ok: true; ast: ExprNode } | { ok: false; error: ExprError }

const COMPARE_OPS = new Set<string>(["=", "!=", "<", "<=", ">", ">="])

class Parser {
  private pos = 0
  private readonly tokens: Token[]
  private readonly srcLen: number
  constructor(tokens: Token[], srcLen: number) {
    this.tokens = tokens
    this.srcLen = srcLen
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos]
  }

  /** Source offset just past the last token — where a "ran off the end" points. */
  private endPos(): number {
    return this.tokens.length ? this.tokens[this.tokens.length - 1].end : this.srcLen
  }

  private isOp(value: string): boolean {
    const t = this.peek()
    return t !== undefined && t.type === "op" && t.value === value
  }

  private expectOp(value: string): Token {
    const t = this.peek()
    if (!t || t.type !== "op" || t.value !== value) {
      const at = t ?? { start: this.endPos(), end: this.endPos() }
      throw new ExprSyntaxError(`Expected ${JSON.stringify(value)}`, at.start, at.end)
    }
    this.pos++
    return t
  }

  parse(): ExprNode {
    const first = this.peek()
    if (!first) throw new ExprSyntaxError("Empty expression", 0, this.srcLen)
    const expr = this.parseOr()
    const rest = this.peek()
    if (rest) throw new ExprSyntaxError("Unexpected trailing input", rest.start, this.endPos())
    return expr
  }

  private parseBinary(op: BinaryOp, next: () => ExprNode): ExprNode {
    let left = next()
    while (this.peek()?.type === "kw" && this.peek()!.value === op) {
      this.pos++
      const right = next()
      const node: Binary = { kind: "binary", op, left, right, start: left.start, end: right.end }
      left = node
    }
    return left
  }

  private parseOr(): ExprNode {
    return this.parseBinary("or", () => this.parseAnd())
  }

  private parseAnd(): ExprNode {
    return this.parseBinary("and", () => this.parseCompare())
  }

  private parseCompare(): ExprNode {
    const left = this.parsePrimary()
    const t = this.peek()
    if (t && t.type === "op" && COMPARE_OPS.has(t.value)) {
      this.pos++
      const right = this.parsePrimary()
      // Non-associative: a second comparison (a = b = c) is a syntax error.
      const after = this.peek()
      if (after && after.type === "op" && COMPARE_OPS.has(after.value)) {
        throw new ExprSyntaxError(
          "Comparison operators cannot be chained",
          after.start,
          after.end,
        )
      }
      const node: Compare = {
        kind: "compare",
        op: t.value as CompareOp,
        left,
        right,
        start: left.start,
        end: right.end,
      }
      return node
    }
    return left
  }

  private parsePrimary(): ExprNode {
    const t = this.peek()
    if (!t) {
      throw new ExprSyntaxError("Expected an expression", this.endPos(), this.endPos())
    }

    if (t.type === "string") {
      this.pos++
      return { kind: "str", value: t.value, start: t.start, end: t.end }
    }
    if (t.type === "number") {
      this.pos++
      return { kind: "num", value: Number(t.value), start: t.start, end: t.end }
    }
    if (t.type === "op" && t.value === "(") {
      this.pos++
      const inner = this.parseOr()
      this.expectOp(")")
      return inner
    }
    // A name followed by '(' is a function call; otherwise it starts a path.
    if (t.type === "name") {
      const after = this.tokens[this.pos + 1]
      if (after && after.type === "op" && after.value === "(") {
        return this.parseCall()
      }
      return this.parsePath()
    }

    throw new ExprSyntaxError(
      `Unexpected ${t.type === "kw" ? `keyword ${JSON.stringify(t.value)}` : JSON.stringify(t.value)}`,
      t.start,
      t.end,
    )
  }

  private parseCall(): Call {
    const nameTok = this.peek()!
    this.pos++ // name
    this.expectOp("(")
    const args: ExprNode[] = []
    if (!this.isOp(")")) {
      args.push(this.parseOr())
      while (this.isOp(",")) {
        this.pos++
        args.push(this.parseOr())
      }
    }
    const close = this.expectOp(")")
    const call: Call = {
      kind: "call",
      name: nameTok.value,
      args,
      start: nameTok.start,
      end: close.end,
    }
    validateCallArgs(call)
    return call
  }

  // Paths are always relative to the constraint's element — there is no
  // absolute (leading-'/') form.
  private parsePath(): Path {
    const start = this.peek()!.start
    const steps: PathStep[] = []
    let last: Token
    for (;;) {
      const t = this.peek()
      if (!t || t.type !== "name") {
        throw new ExprSyntaxError("Expected a path step", t?.start ?? this.endPos(), t?.end ?? this.endPos())
      }
      const isAttribute = t.value.startsWith("@")
      steps.push({ name: isAttribute ? t.value.slice(1) : t.value, isAttribute })
      last = t
      this.pos++
      if (this.isOp("/")) {
        this.pos++
        continue
      }
      break
    }
    return { kind: "path", steps, start, end: last.end }
  }
}

/**
 * Per-function argument checks for the functions with defined semantics
 * (`not`, `matches`, `count`, and the presence-cardinality trio). Any other
 * function name parses with any arity (the open set requested). Checks reject only
 * clearly-wrong arguments (`kindOf` `unknown` always passes), keeping this
 * advisory and false-positive-free.
 */
function validateCallArgs(call: Call): void {
  if (CARDINALITY_FUNCTIONS.has(call.name)) {
    // A choice is between alternatives, so at least two are required; each must be
    // an element or condition (a bare literal can't be "present").
    if (call.args.length < 2) {
      throw new ExprSyntaxError(`${call.name}() takes at least two arguments`, call.start, call.end)
    }
    for (const arg of call.args) {
      const k = kindOf(arg)
      if (k === "string" || k === "number") {
        throw new ExprSyntaxError(
          `${call.name}() arguments must be elements or conditions, not literals`,
          arg.start,
          arg.end,
        )
      }
    }
    return
  }

  if (call.name === "not") {
    if (call.args.length !== 1) {
      throw new ExprSyntaxError("not() takes exactly one argument", call.start, call.end)
    }
    const arg = call.args[0]
    const k = kindOf(arg)
    if (k === "string" || k === "number") {
      throw new ExprSyntaxError("not() expects a boolean expression", arg.start, arg.end)
    }
    return
  }

  if (call.name === "count") {
    if (call.args.length !== 1) {
      throw new ExprSyntaxError("count() takes exactly one argument", call.start, call.end)
    }
    const arg = call.args[0]
    const k = kindOf(arg)
    if (k === "string" || k === "number" || k === "boolean") {
      throw new ExprSyntaxError("count() expects a path expression", arg.start, arg.end)
    }
    return
  }

  if (call.name === "matches") {
    if (call.args.length !== 2) {
      throw new ExprSyntaxError("matches() takes exactly two arguments", call.start, call.end)
    }
    const [input, pattern] = call.args
    if (kindOf(input) === "boolean") {
      throw new ExprSyntaxError(
        "matches() expects a string value as its first argument",
        input.start,
        input.end,
      )
    }
    if (pattern.kind === "str") {
      try {
        new RegExp(pattern.value)
      } catch {
        throw new ExprSyntaxError(
          "matches() pattern is not a valid regular expression",
          pattern.start,
          pattern.end,
        )
      }
    } else if (kindOf(pattern) === "boolean" || kindOf(pattern) === "number") {
      throw new ExprSyntaxError(
        "matches() pattern must be a string",
        pattern.start,
        pattern.end,
      )
    }
  }
}

/**
 * Parse a constraint expression into an AST, or return the first syntax error
 * with its source span. The AST is what the planned path-validation and
 * evaluation phases consume.
 */
export function parseExpression(src: string): ParseResult {
  try {
    const tokens = tokenize(src)
    const ast = new Parser(tokens, src.length).parse()
    return { ok: true, ast }
  } catch (e) {
    if (e instanceof ExprSyntaxError) {
      return { ok: false, error: { message: e.message, start: e.start, end: e.end } }
    }
    throw e
  }
}
