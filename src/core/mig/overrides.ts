import type {
  Constraint,
  ConstraintOverride,
  ElementOverride,
  MessageImplementationGuide,
} from "@/core/types/types"

// Immutable helpers for editing a MIG's element overrides. Override fields are
// tri-state: absent = inherit, `null` = remove the
// constraint, value = set. These use key-presence, never `??`, so a stored
// `null` is preserved rather than collapsed into "inherit".

/** Set one override field at `path`, returning a new MIG. */
export function setOverrideField<K extends keyof ElementOverride>(
  mig: MessageImplementationGuide,
  path: string,
  field: K,
  value: ElementOverride[K],
): MessageImplementationGuide {
  const prev = mig.elementOverrides[path] ?? {}
  return {
    ...mig,
    elementOverrides: {
      ...mig.elementOverrides,
      [path]: { ...prev, [field]: value },
    },
  }
}

/**
 * Remove one override field at `path` (back to inherited). Prunes the override
 * entry entirely when it has no remaining fields, keeping the MIG minimal.
 */
export function clearOverrideField(
  mig: MessageImplementationGuide,
  path: string,
  field: keyof ElementOverride,
): MessageImplementationGuide {
  const prev = mig.elementOverrides[path]
  if (!prev || !(field in prev)) return mig

  const nextOverride = { ...prev }
  delete nextOverride[field]

  const elementOverrides = { ...mig.elementOverrides }
  if (Object.keys(nextOverride).length === 0) delete elementOverrides[path]
  else elementOverrides[path] = nextOverride

  return { ...mig, elementOverrides }
}

const NEW_CONSTRAINT_BASE = "New constraint"

/**
 * A constraint name not already in `existing` — "New constraint", then
 * "New constraint 2", "New constraint 3", … . `existing` should include both the
 * element's standard constraints and any already-added MIG ones, since constraint
 * names must be unique within an element.
 */
export function nextConstraintName(existing: Iterable<string>): string {
  const used = new Set(existing)
  if (!used.has(NEW_CONSTRAINT_BASE)) return NEW_CONSTRAINT_BASE
  for (let i = 2; ; i++) {
    const name = `${NEW_CONSTRAINT_BASE} ${i}`
    if (!used.has(name)) return name
  }
}

/**
 * Append a MIG-specific (additional) constraint to `path`, returning a new MIG.
 * No-op if a constraint of the same name is already in the override's
 * `additionalConstraints` (names must be unique within an element).
 */
export function addConstraint(
  mig: MessageImplementationGuide,
  path: string,
  constraint: Constraint,
): MessageImplementationGuide {
  const prev = mig.elementOverrides[path] ?? {}
  const existing = prev.additionalConstraints ?? []
  if (existing.some((c) => c.name === constraint.name)) return mig
  return {
    ...mig,
    elementOverrides: {
      ...mig.elementOverrides,
      [path]: { ...prev, additionalConstraints: [...existing, constraint] },
    },
  }
}

/**
 * Edit a MIG-specific constraint (found by its current `name`) at `path`,
 * applying `changes` (name, definition, expression, and/or annotation values),
 * returning a new MIG. An empty `expression` or emptied `annotations` is pruned
 * to keep the MIG minimal (both are optional). No-op when the path has no such
 * additional constraint, or when a rename would collide with another additional
 * constraint there (names are unique within an element). Standard, spec-inherited
 * constraints aren't represented here and are untouched.
 */
export function updateConstraint(
  mig: MessageImplementationGuide,
  path: string,
  name: string,
  changes: Partial<Pick<Constraint, "name" | "definition" | "expression" | "annotations">>,
): MessageImplementationGuide {
  const prev = mig.elementOverrides[path]
  const list = prev?.additionalConstraints
  if (!list) return mig
  const idx = list.findIndex((c) => c.name === name)
  if (idx < 0) return mig

  const nextName = changes.name ?? list[idx].name
  if (nextName !== name && list.some((c, i) => i !== idx && c.name === nextName)) return mig

  const merged: Constraint = { ...list[idx], ...changes }
  if (merged.expression === "") delete merged.expression
  if (merged.annotations && Object.keys(merged.annotations).length === 0) delete merged.annotations
  const additionalConstraints = list.map((c, i) => (i === idx ? merged : c))
  return {
    ...mig,
    elementOverrides: {
      ...mig.elementOverrides,
      [path]: { ...prev, additionalConstraints },
    },
  }
}

/**
 * Remove a MIG-specific constraint (by `name`) at `path`, returning a new MIG.
 * Prunes the `additionalConstraints` array when it empties, then the override
 * entry entirely when nothing else remains (keeping the MIG minimal, like
 * `clearOverrideField`). No-op if no such additional constraint exists.
 */
export function removeConstraint(
  mig: MessageImplementationGuide,
  path: string,
  name: string,
): MessageImplementationGuide {
  const prev = mig.elementOverrides[path]
  const list = prev?.additionalConstraints
  if (!list || !list.some((c) => c.name === name)) return mig

  const remaining = list.filter((c) => c.name !== name)
  const nextOverride = { ...prev }
  if (remaining.length === 0) delete nextOverride.additionalConstraints
  else nextOverride.additionalConstraints = remaining

  const elementOverrides = { ...mig.elementOverrides }
  if (Object.keys(nextOverride).length === 0) delete elementOverrides[path]
  else elementOverrides[path] = nextOverride

  return { ...mig, elementOverrides }
}

/**
 * Set one field of the overlay on the standard/inherited constraint `name` at
 * `path` (tri-state value, e.g. an `expression` string or `null`), returning a
 * new MIG. Creates the `constraintOverrides` map and entry as needed.
 */
export function setConstraintOverrideField<K extends keyof ConstraintOverride>(
  mig: MessageImplementationGuide,
  path: string,
  name: string,
  field: K,
  value: ConstraintOverride[K],
): MessageImplementationGuide {
  const prev = mig.elementOverrides[path] ?? {}
  const map = prev.constraintOverrides ?? {}
  return {
    ...mig,
    elementOverrides: {
      ...mig.elementOverrides,
      [path]: {
        ...prev,
        constraintOverrides: { ...map, [name]: { ...map[name], [field]: value } },
      },
    },
  }
}

/**
 * Remove one field of the overlay on constraint `name` at `path` (back to
 * inherited). Prunes the emptied entry, then the `constraintOverrides` map, then
 * the override entry — keeping the MIG minimal, like `clearOverrideField`.
 */
export function clearConstraintOverrideField(
  mig: MessageImplementationGuide,
  path: string,
  name: string,
  field: keyof ConstraintOverride,
): MessageImplementationGuide {
  const prev = mig.elementOverrides[path]
  const entry = prev?.constraintOverrides?.[name]
  if (!entry || !(field in entry)) return mig

  const nextEntry = { ...entry }
  delete nextEntry[field]
  const map = { ...prev.constraintOverrides }
  if (Object.keys(nextEntry).length === 0) delete map[name]
  else map[name] = nextEntry

  const nextOverride = { ...prev }
  if (Object.keys(map).length === 0) delete nextOverride.constraintOverrides
  else nextOverride.constraintOverrides = map

  const elementOverrides = { ...mig.elementOverrides }
  if (Object.keys(nextOverride).length === 0) delete elementOverrides[path]
  else elementOverrides[path] = nextOverride

  return { ...mig, elementOverrides }
}
