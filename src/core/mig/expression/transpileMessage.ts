// Derive the DSL form of a message's ISO constraint expressions.
//
// The repository parser keeps each standard constraint's official rule as a raw
// `RuleDefinition` XML blob (`Constraint.isoExpression`). This module turns that
// into the app's path DSL (`Constraint.expression`), doing the two schema-aware
// steps `ruleDefinitionToDsl` can't do on its own because it lacks the tree:
//   • translate ISO element *names* (`GroupHeader`) to the DSL's `xmlTag`s (`GrpHdr`)
//   • drop a `[1]`/`[*]` occurrence marker on any `maxOccurs == 1` element (a
//     singleton node-set's existential value is that one occurrence — safe in any
//     context)
// then runs `ruleDefinitionToDsl` (with the WithInList code-set resolver) and
// re-validates the result's paths against the owner. FAIL CLOSED: a rule that
// doesn't transpile *and* validate yields `null` — an external validator must
// never receive a plausible-but-wrong expression.
//
// This is the runtime counterpart of `tools/errata/generate.mts`, which imports
// these helpers so the offline report and the in-app export stay in lock-step.

import type { MessageDefinition, MessageElement } from "@/core/types/types"
import { ruleDefinitionToDsl } from "./ruleDefinitionToDsl"
import { parseExpression } from "./parser"
import { validateExpressionPaths } from "./paths"

type Resolver = (codeSetName: string) => string[] | undefined

/** Split a path step into element/attribute name and an optional `[*]`/`[n]` marker. */
function splitStep(step: string): { name: string; marker: string } {
  const m = /^(.*?)(\[\*\]|\[\d+\])?$/.exec(step)!
  return { name: m[1], marker: m[2] ?? "" }
}

/**
 * Resolve one operand path against the schema: translate each ISO element name to
 * its `xmlTag` and drop a `[1]`/`[*]` marker on any `maxOccurs == 1` step. A step
 * that doesn't resolve is emitted as-is, so the later path validation flags it
 * (and the rule is skipped). Only paths (operands starting with `/`) are touched.
 */
function resolvePath(owner: MessageElement, path: string): string {
  const steps = path.replace(/^\//, "").split("/")
  let current: MessageElement | null = owner
  const out: string[] = []
  for (const raw of steps) {
    const { name, marker } = splitStep(raw)
    const isAttr = name.startsWith("@")
    const plain = isAttr ? name.slice(1) : name
    const child: MessageElement | undefined = current?.elements.find(
      (c) => c.name === plain && c.isAttribute === isAttr
    )
    if (!child) {
      out.push(name + marker) // unresolved — leave for the validator to flag
      current = null
      continue
    }
    const tag = (isAttr ? "@" : "") + child.xmlTag
    const drop = child.maxOccurs === 1 && (marker === "[1]" || marker === "[*]")
    out.push(drop ? tag : tag + marker)
    current = child
  }
  return "/" + out.join("/")
}

/** Rewrite every `<left|rightOperand>` path in the raw rule XML via `resolvePath`. */
export function resolveOperands(owner: MessageElement, xml: string): string {
  return xml.replace(
    /<(left|right)Operand>(\/[^<]*)<\/\1Operand>/g,
    (_w, side, path) => `<${side}Operand>${resolvePath(owner, path)}</${side}Operand>`
  )
}

/**
 * Transpile one raw ISO `RuleDefinition` blob to DSL, relative to `owner`.
 * Returns the DSL only when it both transpiles and re-validates against the
 * owner's tree; otherwise `null` (fail closed).
 */
export function transpileConstraintExpression(
  owner: MessageElement,
  isoExpression: string,
  resolveCodeList?: Resolver
): string | null {
  const result = ruleDefinitionToDsl(resolveOperands(owner, isoExpression), {
    resolveCodeList,
  })
  if (!result.ok) return null
  const parsed = parseExpression(result.dsl)
  if (!parsed.ok) return null
  if (validateExpressionPaths(parsed.ast, owner).length > 0) return null
  return result.dsl
}

/**
 * Fill in the DSL `expression` of every standard constraint in a message tree
 * from its raw `isoExpression`, in place. Idempotent: a constraint that already
 * has an `expression`, or no `isoExpression`, is left untouched. Paths resolve
 * relative to the element each constraint is attached to.
 */
export function enrichMessageDsl(
  message: MessageDefinition,
  resolveCodeList?: Resolver
): void {
  const walk = (el: MessageElement, ancestors: Set<string>): void => {
    for (const c of el.constraints ?? []) {
      if (c.expression || !c.isoExpression) continue
      const dsl = transpileConstraintExpression(el, c.isoExpression, resolveCodeList)
      if (dsl) c.expression = dsl
    }
    if (ancestors.has(el.id)) return // guard against recursive type cycles
    const next = new Set(ancestors).add(el.id)
    for (const child of el.elements ?? []) walk(child, next)
  }
  walk(message.rootElement, new Set())
}
