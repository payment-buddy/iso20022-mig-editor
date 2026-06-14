// Public surface of the constraint-expression module. The UI uses
// `validateConstraintExpression`; the evaluation phase will consume the AST via
// `parseExpression`.

import type { MessageElement } from "@/core/types/types"

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
export { collectPaths, pathText, validateExpressionPaths } from "./paths"
export { evaluateExpression, type EvalNode, type EvalResult } from "./evaluate"
export {
  ruleDefinitionToDsl,
  type TranspileOptions,
  type TranspileResult,
} from "./ruleDefinitionToDsl"
export {
  buildCodeListResolver,
  type RepoCode,
  type RepoCodeSet,
} from "./codeListResolver"
export {
  enrichMessageDsl,
  resolveOperands,
  transpileConstraintExpression,
} from "./transpileMessage"

import { parseExpression } from "./parser"
import { validateExpressionPaths } from "./paths"

/** Format a parse error with its 1-based source position. */
const atPosition = (message: string, start: number) =>
  `${message} (at position ${start + 1})`

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
  return atPosition(result.error.message, result.error.start)
}

/**
 * Validate a constraint expression for display: first its syntax, then — when it
 * parses and an `owner` element is given — that each location path resolves to a
 * nested element/attribute of that owner. Returns one advisory message per issue
 * (empty when clean). A syntax error short-circuits path checks. Never blocks
 * editing or export.
 */
export function validateConstraintExpression(
  src: string,
  owner: MessageElement | null
): string[] {
  if (src.trim() === "") return []
  const result = parseExpression(src)
  if (!result.ok) return [atPosition(result.error.message, result.error.start)]
  if (!owner) return []
  return validateExpressionPaths(result.ast, owner).map((e) =>
    atPosition(e.message, e.start)
  )
}
