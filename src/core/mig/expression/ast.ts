// AST for the XPath-like boolean predicate in a Constraint's `expression` field.
//
// The parser (`parser.ts`) produces these nodes; the syntax validator is a thin
// consumer. The tree is the load-bearing part: two planned follow-on phases —
// resolving path steps against the element tree, and evaluating an expression
// against a message — both walk it. Every node carries `start`/`end` source
// offsets so those phases (and error reporting) can point back at the text.

/** Infix boolean connectives, lowest precedence. */
export type BinaryOp = "or" | "and"

/** Comparison / equality operators (non-associative). */
export type CompareOp = "=" | "!=" | "<" | "<=" | ">" | ">="

export interface Binary {
  kind: "binary"
  op: BinaryOp
  left: ExprNode
  right: ExprNode
  start: number
  end: number
}

export interface Compare {
  kind: "compare"
  op: CompareOp
  left: ExprNode
  right: ExprNode
  start: number
  end: number
}

export interface Call {
  kind: "call"
  name: string
  args: ExprNode[]
  start: number
  end: number
}

/** One step of a location path, e.g. `Prtry` or the attribute `@Ccy`. */
export interface PathStep {
  name: string
  isAttribute: boolean
}

export interface Path {
  kind: "path"
  steps: PathStep[]
  start: number
  end: number
}

export interface Str {
  kind: "str"
  value: string
  start: number
  end: number
}

export interface Num {
  kind: "num"
  value: number
  start: number
  end: number
}

export type ExprNode = Binary | Compare | Call | Path | Str | Num

/**
 * Presence-cardinality functions: count how many arguments hold, then bound the
 * tally (`≥1` / `≤1` / `=1`). Boolean-returning, like `not`/`matches`.
 */
export const CARDINALITY_FUNCTIONS = new Set(["at-least-one", "at-most-one", "exactly-one"])

/** Coarse value type, used to flag clearly-wrong function arguments. */
export type ValueKind = "boolean" | "string" | "number" | "unknown"

/**
 * Best-effort value-kind of a node. `boolean` for connectives, comparisons, and
 * the boolean-returning `not`/`matches`; `number` for literals and the
 * node-counting `count`; `string` for literals; `unknown` for a path (could be a
 * node, string, or existence test) or any other function call (return type
 * unknown). Argument checks treat `unknown` as acceptable, so they only ever
 * reject what's definitely wrong.
 */
export function kindOf(node: ExprNode): ValueKind {
  switch (node.kind) {
    case "binary":
    case "compare":
      return "boolean"
    case "call":
      if (node.name === "not" || node.name === "matches") return "boolean"
      if (CARDINALITY_FUNCTIONS.has(node.name)) return "boolean"
      if (node.name === "count") return "number"
      return "unknown"
    case "str":
      return "string"
    case "num":
      return "number"
    case "path":
      return "unknown"
  }
}
