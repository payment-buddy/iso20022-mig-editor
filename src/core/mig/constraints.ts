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
  /**
   * The rule is switched off — for a standard/inherited constraint via its
   * `constraintOverrides` entry, for a MIG-added one via its own `enabled: false`.
   */
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
  if (co.annotations) {
    const merged = constraintAnnotations(base, override)
    if (Object.keys(merged).length > 0) out.annotations = merged
    else delete out.annotations
  }
  return out
}

/**
 * The effective annotation values of a constraint at an element path: the base
 * constraint's own `annotations` (set on a MIG-added constraint) overlaid by the
 * `constraintOverrides[name].annotations` entry — per name, `null`/absent clears.
 * `override` is the **effective** (own + inherited) override for the element's
 * path. Used both to overlay reported constraints and to resolve the inherited
 * baseline a child's annotation field shows.
 */
export function constraintAnnotations(
  base: Pick<Constraint, "name" | "annotations">,
  override: ElementOverride | undefined
): Record<string, string> {
  const out: Record<string, string> = {}
  const apply = (map: Record<string, string | null> | undefined) => {
    for (const [name, value] of Object.entries(map ?? {})) {
      if (value == null || value === "") delete out[name]
      else out[name] = value
    }
  }
  apply(base.annotations)
  apply(override?.constraintOverrides?.[base.name]?.annotations)
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
  const additional = Object.entries(override?.additionalConstraints ?? {}).map(
    ([name, ac]): ResolvedConstraint => {
      // `enabled` is the rule's own off switch, not a constraint field — keep it
      // out of the resolved `Constraint`. The legacy `constraintOverrides` disable
      // is still honoured for MIGs saved before the flag moved here.
      const { enabled, ...base } = ac
      return {
        constraint: overlay({ name, ...base }, override),
        source: "additional",
        disabled: enabled === false || disabled(name),
      }
    }
  )
  return [...standard, ...additional]
}
