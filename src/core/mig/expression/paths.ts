// Phase 2: resolve a parsed expression's location paths against the element tree.
//
// A constraint's paths are relative to the element it's attached to (its
// "owner"). Each step matches a child by `xmlTag`; an attribute step (`@Ccy`)
// must match a child with `isAttribute`, and an attribute is a leaf so it can't
// carry further steps. Resolution is advisory — it reports the steps that don't
// exist so a typo surfaces, but never blocks editing or export.

import type { MessageElement } from "@/core/types/types"
import type { ExprNode, Path } from "./ast"
import type { ExprError } from "./parser"

/** Reconstruct a path's source text, e.g. `SchmeNm/Prtry` or `Amt/@Ccy`. */
export function pathText(path: Path): string {
  return path.steps.map((s) => (s.isAttribute ? "@" : "") + s.name).join("/")
}

/** Collect every location path in an AST (depth-first, left to right). */
export function collectPaths(node: ExprNode): Path[] {
  switch (node.kind) {
    case "path":
      return [node]
    case "binary":
    case "compare":
      return [...collectPaths(node.left), ...collectPaths(node.right)]
    case "call":
      return node.args.flatMap(collectPaths)
    case "str":
    case "num":
      return []
  }
}

/** Resolve a single path against `owner`, returning an error or `null`. */
function resolvePath(owner: MessageElement, path: Path): ExprError | null {
  const fail = (message: string): ExprError => ({
    message: `${message} in path "${pathText(path)}"`,
    start: path.start,
    end: path.end,
  })

  let current = owner
  for (let i = 0; i < path.steps.length; i++) {
    const step = path.steps[i]
    const child = current.elements.find(
      (c) => c.xmlTag === step.name && c.isAttribute === step.isAttribute,
    )
    if (!child) {
      // A name match of the wrong kind gives a more pointed hint than "unknown".
      const wrongKind = current.elements.find((c) => c.xmlTag === step.name)
      if (wrongKind) {
        return fail(
          step.isAttribute
            ? `"${step.name}" is an element, not an attribute`
            : `"${step.name}" is an attribute — reference it as "@${step.name}"`,
        )
      }
      const label = step.isAttribute ? `attribute "@${step.name}"` : `element "${step.name}"`
      return fail(`Unknown ${label}`)
    }
    // Attributes are leaves: a step after one can never resolve.
    if (child.isAttribute && i < path.steps.length - 1) {
      return fail(`Attribute "@${step.name}" cannot have child steps`)
    }
    current = child
  }
  return null
}

/**
 * Validate every path in `ast` against the constraint's owning element, returning
 * one error per unresolved path (in source order). Empty when all paths resolve.
 */
export function validateExpressionPaths(ast: ExprNode, owner: MessageElement): ExprError[] {
  const errors: ExprError[] = []
  for (const path of collectPaths(ast)) {
    const error = resolvePath(owner, path)
    if (error) errors.push(error)
  }
  return errors
}
