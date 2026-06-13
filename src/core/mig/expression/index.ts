// Public surface of the constraint-expression module. The UI uses
// `validateExpressionSyntax`; later phases (path resolution, evaluation) consume
// the AST via `parseExpression`.

export type {
  Binary,
  BinaryOp,
  Call,
  Compare,
  CompareOp,
  ExprNode,
  Num,
  Path,
  PathStep,
  Str,
  ValueKind,
} from "./ast"
export { kindOf } from "./ast"
export { parseExpression, type ExprError, type ParseResult } from "./parser"

import { parseExpression } from "./parser"

/**
 * Validate a constraint expression's syntax for display. Returns `null` when the
 * field is empty (optional) or parses cleanly, otherwise a one-line message with
 * the 1-based character position, e.g. `Expected ")" (at position 24)`. Advisory
 * only — never blocks editing or export.
 */
export function validateExpressionSyntax(src: string): string | null {
  if (src.trim() === "") return null
  const result = parseExpression(src)
  if (result.ok) return null
  return `${result.error.message} (at position ${result.error.start + 1})`
}
