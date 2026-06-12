// Copy one diffed field (a `FieldRef` from `compareMigs`) from a source MIG into
// a target MIG at the same path, returning a new target MIG. Powers the per-field
// "copy across" buttons in the Compare screen (and is a building block for the
// planned Merge feature). Tri-state preserving: if the source doesn't set the
// field (inherits), the target's field is *cleared* back to inherit; a stored
// `null` (cleared) and a concrete value both copy verbatim.

import {
  addConstraint,
  clearOverrideField,
  removeConstraint,
  setOverrideField,
  updateConstraint,
} from "./overrides"
import type { FieldRef } from "./compareMigs"
import type { MessageImplementationGuide } from "@/core/types/types"

export function applyFieldCopy(
  source: MessageImplementationGuide,
  target: MessageImplementationGuide,
  path: string,
  ref: FieldRef
): MessageImplementationGuide {
  const srcOv = source.elementOverrides[path]

  if (ref.type === "field") {
    const { field } = ref
    // Key-presence, not `??`: a stored `null` (cleared) must copy as `null`, not
    // collapse to "inherit". Source absent → clear the target back to inherit.
    if (srcOv && field in srcOv)
      return setOverrideField(target, path, field, srcOv[field])
    return clearOverrideField(target, path, field)
  }

  if (ref.type === "annotation") {
    const { name } = ref
    const srcVal = srcOv?.annotations?.[name]
    const prev = target.elementOverrides[path]?.annotations ?? {}
    const next = { ...prev }
    if (srcVal === undefined) delete next[name]
    else next[name] = srcVal
    return Object.keys(next).length === 0
      ? clearOverrideField(target, path, "annotations")
      : setOverrideField(target, path, "annotations", next)
  }

  // ref.type === "constraint"
  const { name } = ref
  const srcC = srcOv?.additionalConstraints?.[name]
  const exists =
    target.elementOverrides[path]?.additionalConstraints?.[name] !== undefined

  if (!srcC) return exists ? removeConstraint(target, path, name) : target
  if (!exists) return addConstraint(target, path, name, srcC)
  // Overwrite the existing constraint to mirror the source exactly. Passing ""
  // expression / {} annotations makes updateConstraint prune them when the source
  // has none, so the copy isn't left with stale fields.
  return updateConstraint(target, path, name, {
    definition: srcC.definition,
    expression: srcC.expression ?? "",
    annotations: srcC.annotations ?? {},
  })
}
