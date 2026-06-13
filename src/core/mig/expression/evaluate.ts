// Phase 3: evaluate a parsed constraint expression against a message instance.
//
// The expression is a boolean predicate (see `ast.ts`) whose paths are relative
// to the element the constraint is attached to — the "context node". We adopt a
// small, predictable subset of XPath semantics:
//
//   • A path evaluates to a node-set (the matched elements/attributes).
//   • In boolean context a node-set is true iff non-empty (existence).
//   • A comparison `A op B` is true iff some value of A and some value of B
//     satisfy `op` (XPath "general comparison"); `=`/`!=` compare numerically
//     when both atoms look numeric, else as strings; `< <= > >=` are numeric.
//   • not / matches / count behave as their XPath namesakes.
//
// Anything the evaluator can't compute (an unsupported function, a bad regex)
// yields an indeterminate result rather than a thrown error, so a caller doing
// validation can simply skip the constraint instead of asserting a violation.

import type { ExprNode } from "./ast"

/**
 * Structural view of a parsed XML element — satisfied by `InstanceNode` from
 * `validateInstance`, so callers pass that directly without a circular import.
 */
export interface EvalNode {
  localName: string
  attributes: Record<string, string>
  text: string
  children: EvalNode[]
}

export type EvalResult =
  | { ok: true; value: boolean }
  | { ok: false; reason: string }

/** Thrown internally when a sub-expression can't be evaluated; never escapes. */
class EvalError extends Error {}

/** A member of a node-set: its string value, plus the element when it is one. */
interface NodeRef {
  value: string
  element?: EvalNode
}

type Value =
  | { kind: "bool"; value: boolean }
  | { kind: "num"; value: number }
  | { kind: "str"; value: string }
  | { kind: "nodes"; nodes: NodeRef[] }

const isNumeric = (s: string) => s.trim() !== "" && Number.isFinite(Number(s))

/** XPath-style boolean coercion. */
function toBool(v: Value): boolean {
  switch (v.kind) {
    case "bool":
      return v.value
    case "num":
      return v.value !== 0 && !Number.isNaN(v.value)
    case "str":
      return v.value.length > 0
    case "nodes":
      return v.nodes.length > 0
  }
}

/** The atoms (string forms) a value contributes to a comparison. */
function atoms(v: Value): string[] {
  switch (v.kind) {
    case "nodes":
      return v.nodes.map((n) => n.value)
    case "num":
      return [String(v.value)]
    case "str":
      return [v.value]
    case "bool":
      return [v.value ? "true" : "false"]
  }
}

/** The string value of a value (first node for a node-set, "" when empty). */
function toStr(v: Value): string {
  if (v.kind === "str") return v.value
  if (v.kind === "num") return String(v.value)
  if (v.kind === "bool") return v.value ? "true" : "false"
  return v.nodes[0]?.value ?? ""
}

function compareAtom(op: string, a: string, b: string): boolean {
  if (op === "=" || op === "!=") {
    const eq = isNumeric(a) && isNumeric(b) ? Number(a) === Number(b) : a === b
    return op === "=" ? eq : !eq
  }
  // Ordering is numeric; non-numeric atoms never satisfy it.
  if (!isNumeric(a) || !isNumeric(b)) return false
  const na = Number(a)
  const nb = Number(b)
  switch (op) {
    case "<":
      return na < nb
    case "<=":
      return na <= nb
    case ">":
      return na > nb
    case ">=":
      return na >= nb
  }
  return false
}

/** General comparison: true iff any left atom and right atom satisfy `op`. */
function compareValues(op: string, left: Value, right: Value): boolean {
  const ls = atoms(left)
  const rs = atoms(right)
  for (const a of ls) for (const b of rs) if (compareAtom(op, a, b)) return true
  return false
}

/** Resolve a location path to a node-set, relative to `context`. */
function evalPath(context: EvalNode, steps: { name: string; isAttribute: boolean }[]): NodeRef[] {
  let current: EvalNode[] = [context]
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (step.isAttribute) {
      // Attributes are leaves; a step after one resolves to nothing.
      if (i < steps.length - 1) return []
      return current
        .filter((n) => step.name in n.attributes)
        .map((n) => ({ value: n.attributes[step.name] }))
    }
    current = current.flatMap((n) => n.children.filter((c) => c.localName === step.name))
  }
  return current.map((n) => ({ value: n.text.trim(), element: n }))
}

function evalNode(node: ExprNode, context: EvalNode): Value {
  switch (node.kind) {
    case "str":
      return { kind: "str", value: node.value }
    case "num":
      return { kind: "num", value: node.value }
    case "path":
      return { kind: "nodes", nodes: evalPath(context, node.steps) }
    case "binary": {
      const l = toBool(evalNode(node.left, context))
      // Short-circuit where it matches the operator's semantics.
      if (node.op === "or") return { kind: "bool", value: l || toBool(evalNode(node.right, context)) }
      if (node.op === "and") return { kind: "bool", value: l && toBool(evalNode(node.right, context)) }
      return { kind: "bool", value: l !== toBool(evalNode(node.right, context)) } // xor
    }
    case "compare":
      return {
        kind: "bool",
        value: compareValues(node.op, evalNode(node.left, context), evalNode(node.right, context)),
      }
    case "call":
      return evalCall(node.name, node.args, context)
  }
}

function evalCall(name: string, args: ExprNode[], context: EvalNode): Value {
  switch (name) {
    case "not":
      return { kind: "bool", value: !toBool(evalNode(args[0], context)) }
    case "count": {
      const v = evalNode(args[0], context)
      if (v.kind !== "nodes") throw new EvalError("count() expects a node-set")
      return { kind: "num", value: v.nodes.length }
    }
    case "matches": {
      const input = toStr(evalNode(args[0], context))
      const pattern = toStr(evalNode(args[1], context))
      let re: RegExp
      try {
        re = new RegExp(pattern)
      } catch {
        throw new EvalError("matches() pattern is not a valid regular expression")
      }
      return { kind: "bool", value: re.test(input) }
    }
    default:
      throw new EvalError(`Unsupported function "${name}"`)
  }
}

/**
 * Evaluate a constraint expression against a context node, returning its boolean
 * truth. `{ ok: false }` means the result is indeterminate (an unsupported
 * function or a bad regex) — the caller should skip rather than treat it as a
 * violation.
 */
export function evaluateExpression(ast: ExprNode, context: EvalNode): EvalResult {
  try {
    return { ok: true, value: toBool(evalNode(ast, context)) }
  } catch (e) {
    if (e instanceof EvalError) return { ok: false, reason: e.message }
    throw e
  }
}
