// Resolve the effective constraints of an element: the standard (ISO) ones plus
// the MIG-added ones, each overlaid with its `constraintOverrides` entry. One
// pure helper shared by the tree and instance validation so they never diverge.

import type {
  Constraint,
  ElementOverride,
  MessageElement,
} from "@/core/types/types"

export interface ResolvedConstraint {
  /** The effective constraint (name, definition, expression after the overlay). */
  constraint: Constraint
  /** Where the base constraint comes from. */
  source: "standard" | "additional"
  /** The rule is switched off by a `constraintOverrides` entry. */
  disabled: boolean
}

/** Apply a constraint override entry onto a base constraint (key-presence; `null` clears). */
function overlay(
  base: Constraint,
  override: ElementOverride | undefined
): Constraint {
  const co = override?.constraintOverrides?.[base.name]
  if (!co) return base
  const out: Constraint = { ...base }
  // Definition is a required string on Constraint; a `null` overlay blanks it.
  if ("definition" in co) out.definition = co.definition ?? ""
  if ("expression" in co) {
    if (co.expression == null) delete out.expression
    else out.expression = co.expression
  }
  return out
}

/**
 * The element's effective constraints in display order: standard (ISO) first,
 * then MIG-added — each overlaid with its `constraintOverrides` entry. `override`
 * is the **effective** (own + inherited) override for this element's path.
 */
export function resolveConstraints(
  el: MessageElement,
  override: ElementOverride | undefined
): ResolvedConstraint[] {
  const disabled = (name: string) =>
    override?.constraintOverrides?.[name]?.disabled ?? false
  const standard = el.constraints.map(
    (c): ResolvedConstraint => ({
      constraint: overlay(c, override),
      source: "standard",
      disabled: disabled(c.name),
    })
  )
  const additional = (override?.additionalConstraints ?? []).map(
    (c): ResolvedConstraint => ({
      constraint: overlay(c, override),
      source: "additional",
      disabled: disabled(c.name),
    })
  )
  return [...standard, ...additional]
}
