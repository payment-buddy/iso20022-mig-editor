import { elementAtPath } from "@/core/erepository/elementPath"
import { resolveMessage } from "@/core/erepository/resolveMessage"
import type {
  AdditionalConstraint,
  ConstraintOverride,
  ElementOverride,
  ElementOverrides,
  ERepository,
  MessageElement,
  MessageImplementationGuide,
} from "@/core/types/types"
import { arraysEqual, fieldBaseline, NUMERIC_FACETS } from "./baseline"
import { effectiveMig } from "./effectiveMig"
import { getMigKey } from "./migKey"

// Prune **no-op** overrides from a MIG, the same way the editor does on every
// save: a field whose value equals its baseline (inherited-or-ISO) is dropped,
// and an override left with no fields is removed entirely. The editor applies
// this per keystroke (the `commit*` handlers in `MigElementDetail.tsx`), but a
// YAML import skips it, so an imported MIG can carry redundant overrides that
// then leak into storage, revisions, diffs, and exports. Run this at the import
// boundary to make imported MIGs as slim as hand-edited ones.

/** Scalar/list facets that carry a single inherited-or-ISO baseline. */
const SCALAR_OR_LIST_FIELDS: (keyof ElementOverride)[] = [
  "definition",
  "pattern",
  "allowedValues",
  "examples",
  ...NUMERIC_FACETS,
]

/** Whether a scalar/list override field equals its baseline (so it can be dropped). */
function isBaselineNoOp(
  field: keyof ElementOverride,
  value: ElementOverride[keyof ElementOverride],
  element: MessageElement,
  inherited: ElementOverride | undefined
): boolean {
  if (value === undefined) return false
  const baseline = fieldBaseline(field, element, inherited)
  if (field === "pattern") {
    // The editor treats an empty pattern as `null` ("no pattern").
    return (value === "" ? null : value) === baseline
  }
  if (field === "allowedValues" || field === "examples") {
    const list = value as string[]
    return list.length === 0 || arraysEqual(list, (baseline as string[]) ?? [])
  }
  return value === baseline
}

/** Mechanical cleanup of a MIG-added constraint, mirroring `updateConstraint`. */
function pruneAdditionalConstraint(
  c: AdditionalConstraint
): AdditionalConstraint {
  const out: AdditionalConstraint = { ...c }
  if (out.expression === "") delete out.expression
  // Absent = enabled is the default; never persist `enabled: true`.
  if (out.enabled !== false) delete out.enabled
  if (out.annotations && Object.keys(out.annotations).length === 0)
    delete out.annotations
  return out
}

/** Drop a structurally empty annotations overlay from a constraint override. */
function pruneConstraintOverride(o: ConstraintOverride): ConstraintOverride {
  const out: ConstraintOverride = { ...o }
  if (out.annotations && Object.keys(out.annotations).length === 0)
    delete out.annotations
  return out
}

/**
 * Return a copy of `override` with no-op scalar/list fields dropped, empty
 * annotation values removed, and the composite constraint maps tidied. May be
 * empty (the caller drops the path when so).
 */
function pruneOverride(
  override: ElementOverride,
  element: MessageElement,
  inherited: ElementOverride | undefined
): ElementOverride {
  const next: ElementOverride = { ...override }

  for (const field of SCALAR_OR_LIST_FIELDS) {
    if (field in next && isBaselineNoOp(field, next[field], element, inherited))
      delete next[field]
  }

  // Element annotations: drop empty-valued entries, then the map if empty.
  if (next.annotations) {
    const cleaned: Record<string, string> = {}
    for (const [name, value] of Object.entries(next.annotations))
      if (value.trim() !== "") cleaned[name] = value
    if (Object.keys(cleaned).length > 0) next.annotations = cleaned
    else delete next.annotations
  }

  if (next.additionalConstraints) {
    const cleaned: Record<string, AdditionalConstraint> = {}
    for (const [name, c] of Object.entries(next.additionalConstraints))
      cleaned[name] = pruneAdditionalConstraint(c)
    if (Object.keys(cleaned).length > 0) next.additionalConstraints = cleaned
    else delete next.additionalConstraints
  }

  if (next.constraintOverrides) {
    const cleaned: Record<string, ConstraintOverride> = {}
    for (const [name, o] of Object.entries(next.constraintOverrides)) {
      const pruned = pruneConstraintOverride(o)
      if (Object.keys(pruned).length > 0) cleaned[name] = pruned
    }
    if (Object.keys(cleaned).length > 0) next.constraintOverrides = cleaned
    else delete next.constraintOverrides
  }

  return next
}

/**
 * Drop no-op overrides from `mig`, comparing each field against the baseline it
 * would reset to in the editor (the parent chain's effective value, else the ISO
 * standard). Pure — returns a new MIG, never mutates the input.
 *
 * Conservative when it can't judge a value: if the message can't be resolved
 * from `repo`, the MIG is returned unchanged; an override whose path isn't
 * present in the resolved message is kept as-is. Tri-state `null` survives — a
 * field is dropped only when it *equals* its baseline.
 */
export function normalizeMig(
  mig: MessageImplementationGuide,
  repo: ERepository,
  allMigs: MessageImplementationGuide[]
): MessageImplementationGuide {
  const resolved = resolveMessage(repo, mig.messageIdentifier)
  if (!resolved) return mig
  const root = resolved.current.rootElement

  // Inherited baseline = the parent chain's effective overrides (empty when this
  // MIG has no parent, or its parent isn't loaded) — same source the editor uses.
  const parent = mig.parentMIG
    ? allMigs.find((m) => getMigKey(m) === mig.parentMIG)
    : undefined
  const inheritedOverrides = parent
    ? effectiveMig(parent, allMigs).mig.elementOverrides
    : {}

  const nextOverrides: ElementOverrides = {}
  for (const [path, override] of Object.entries(mig.elementOverrides)) {
    const element = elementAtPath(root, path)
    if (!element) {
      nextOverrides[path] = override
      continue
    }
    const pruned = pruneOverride(override, element, inheritedOverrides[path])
    if (Object.keys(pruned).length > 0) nextOverrides[path] = pruned
  }

  return { ...mig, elementOverrides: nextOverrides }
}
