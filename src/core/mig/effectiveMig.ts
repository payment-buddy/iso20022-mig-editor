// Effective-MIG merge: flatten a MIG's `parentMIG` chain into one overlay.
//
// A MIG inherits from its parent chain; the **effective** overlay applied to the
// ISO message is the chain merged ancestor → leaf, the leaf winning per field.
// The merge is **key-presence**, not `??`: a
// descendant's explicit `null` ("remove the constraint") must beat an ancestor's
// value, so a plain `{ ...ancestor, ...descendant }` spread (which only copies
// keys that are present) is exactly right — `??` would wrongly treat `null` as
// absent. Composite fields accumulate instead of replacing: `annotations` merge
// per name, `additionalConstraints` union by name (the leaf wins on a clash).
// Removing an inherited annotation value or constraint isn't expressible.

import { getMigKey } from "./migKey"
import type {
  Constraint,
  ConstraintOverride,
  ElementOverride,
  ElementOverrides,
  MessageImplementationGuide,
} from "@/core/types/types"

/** Union two constraint lists by name, the later list winning on a name clash. */
function unionConstraints(
  base: Constraint[] = [],
  layer: Constraint[] = []
): Constraint[] {
  const byName = new Map<string, Constraint>()
  for (const c of base) byName.set(c.name, c)
  for (const c of layer) byName.set(c.name, c)
  return [...byName.values()]
}

/**
 * Merge two `constraintOverrides` maps by name; within a name, layer fields win
 * by key-presence (a descendant's `null`/`false` beats an ancestor's value).
 */
function mergeConstraintOverrides(
  base: Record<string, ConstraintOverride> = {},
  layer: Record<string, ConstraintOverride> = {}
): Record<string, ConstraintOverride> {
  const out: Record<string, ConstraintOverride> = {}
  for (const name of new Set([...Object.keys(base), ...Object.keys(layer)])) {
    out[name] = { ...base[name], ...layer[name] }
  }
  return out
}

/** Merge one override layer over a base: scalars by key-presence, composites accumulate. */
function mergeOverride(
  base: ElementOverride,
  layer: ElementOverride
): ElementOverride {
  const out: ElementOverride = { ...base, ...layer } // scalars/facets: layer wins, null preserved

  const annotations = {
    ...(base.annotations ?? {}),
    ...(layer.annotations ?? {}),
  }
  if (Object.keys(annotations).length > 0) out.annotations = annotations
  else delete out.annotations

  const constraints = unionConstraints(
    base.additionalConstraints,
    layer.additionalConstraints
  )
  if (constraints.length > 0) out.additionalConstraints = constraints
  else delete out.additionalConstraints

  const constraintOverrides = mergeConstraintOverrides(
    base.constraintOverrides,
    layer.constraintOverrides
  )
  if (Object.keys(constraintOverrides).length > 0)
    out.constraintOverrides = constraintOverrides
  else delete out.constraintOverrides

  return out
}

/**
 * Merge the element overrides of a chain (ancestor-first … leaf-last) into one
 * effective map, the leaf winning. Empty merged entries are pruned.
 */
export function mergeOverrides(
  chain: MessageImplementationGuide[]
): ElementOverrides {
  const paths = new Set<string>()
  for (const m of chain)
    for (const p of Object.keys(m.elementOverrides)) paths.add(p)

  const out: ElementOverrides = {}
  for (const path of paths) {
    let merged: ElementOverride = {}
    for (const m of chain) {
      const layer = m.elementOverrides[path]
      if (layer) merged = mergeOverride(merged, layer)
    }
    if (Object.keys(merged).length > 0) out[path] = merged
  }
  return out
}

/** Resolved parent chain, ancestor-first … leaf-last, plus any unresolved parent key. */
export type ResolvedChain = {
  chain: MessageImplementationGuide[]
  /** A `parentMIG` reference that couldn't be resolved (not loaded) — chain stops below it. */
  missingParent?: string
}

/**
 * Walk `mig`'s `parentMIG` links into a chain, ancestor-first. Stops (without
 * looping) on a cycle, and reports the first parent key that isn't in `allMigs`.
 */
export function resolveParentChain(
  mig: MessageImplementationGuide,
  allMigs: MessageImplementationGuide[]
): ResolvedChain {
  const byKey = new Map(allMigs.map((m) => [getMigKey(m), m]))
  const chain: MessageImplementationGuide[] = [mig]
  const seen = new Set<string>([getMigKey(mig)])

  let current = mig
  let missingParent: string | undefined
  while (current.parentMIG) {
    const parentKey = current.parentMIG
    if (seen.has(parentKey)) break // cycle guard
    const parent = byKey.get(parentKey)
    if (!parent) {
      missingParent = parentKey
      break
    }
    seen.add(parentKey)
    chain.push(parent)
    current = parent
  }

  chain.reverse()
  return { chain, missingParent }
}

/** Union a per-MIG name list across the chain, ancestor-first, de-duplicated. */
function unionNames(
  chain: MessageImplementationGuide[],
  pick: (m: MessageImplementationGuide) => string[] | undefined
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const m of chain) {
    for (const name of pick(m) ?? []) {
      if (!seen.has(name)) {
        seen.add(name)
        out.push(name)
      }
    }
  }
  return out
}

export type EffectiveMig = ResolvedChain & {
  /**
   * The flattened MIG — the leaf's identity/metadata with the chain's overrides
   * and annotation names merged in, and **no** `parentMIG`. A computed view for
   * diffing/reporting; not meant to be stored.
   */
  mig: MessageImplementationGuide
}

/**
 * Flatten `mig` and its parent chain into a single effective MIG (the overlay
 * applied to the ISO message). Identity/description come from the leaf; override
 * maps and annotation-name lists are merged across the chain. If a parent isn't
 * loaded, the result reflects the resolvable part and sets `missingParent`.
 */
export function effectiveMig(
  mig: MessageImplementationGuide,
  allMigs: MessageImplementationGuide[]
): EffectiveMig {
  const { chain, missingParent } = resolveParentChain(mig, allMigs)

  const out: MessageImplementationGuide = {
    name: mig.name,
    version: mig.version,
    messageIdentifier: mig.messageIdentifier,
    elementOverrides: mergeOverrides(chain),
  }
  if (mig.description) out.description = mig.description
  const elementNames = unionNames(chain, (m) => m.elementAnnotationNames)
  const constraintNames = unionNames(chain, (m) => m.constraintAnnotationNames)
  if (elementNames.length > 0) out.elementAnnotationNames = elementNames
  if (constraintNames.length > 0)
    out.constraintAnnotationNames = constraintNames

  return { mig: out, chain, missingParent }
}
