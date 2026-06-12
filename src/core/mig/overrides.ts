import type {
  AdditionalConstraint,
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
  value: ElementOverride[K]
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
  field: keyof ElementOverride
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
 * Add a MIG-specific (additional) constraint under `name` at `path`, returning a
 * new MIG. No-op if a constraint of the same name is already in the override's
 * `additionalConstraints` (names must be unique within an element).
 */
export function addConstraint(
  mig: MessageImplementationGuide,
  path: string,
  name: string,
  constraint: AdditionalConstraint
): MessageImplementationGuide {
  const prev = mig.elementOverrides[path] ?? {}
  const existing = prev.additionalConstraints ?? {}
  if (name in existing) return mig
  return {
    ...mig,
    elementOverrides: {
      ...mig.elementOverrides,
      [path]: {
        ...prev,
        additionalConstraints: { ...existing, [name]: constraint },
      },
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
  changes: Partial<{ name: string } & AdditionalConstraint>
): MessageImplementationGuide {
  const prev = mig.elementOverrides[path]
  const map = prev?.additionalConstraints
  if (!map || !(name in map)) return mig

  const { name: renamed, ...fields } = changes
  const nextName = renamed ?? name
  // Rename onto another existing constraint would collide — names are unique.
  if (nextName !== name && nextName in map) return mig

  const merged: AdditionalConstraint = { ...map[name], ...fields }
  if (merged.expression === "") delete merged.expression
  if (merged.annotations && Object.keys(merged.annotations).length === 0)
    delete merged.annotations

  // Rebuild in order, swapping the entry in place (renaming its key if needed).
  const additionalConstraints: Record<string, AdditionalConstraint> = {}
  for (const [key, value] of Object.entries(map))
    additionalConstraints[key === name ? nextName : key] =
      key === name ? merged : value
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
 * Prunes the `additionalConstraints` array when it empties, drops any leftover
 * `constraintOverrides` entry for the same name (e.g. a disable toggle), then the
 * override entry entirely when nothing else remains (keeping the MIG minimal,
 * like `clearOverrideField`). No-op if no such additional constraint exists.
 */
export function removeConstraint(
  mig: MessageImplementationGuide,
  path: string,
  name: string
): MessageImplementationGuide {
  const prev = mig.elementOverrides[path]
  const map = prev?.additionalConstraints
  if (!map || !(name in map)) return mig

  const remaining = { ...map }
  delete remaining[name]
  const nextOverride = { ...prev }
  if (Object.keys(remaining).length === 0)
    delete nextOverride.additionalConstraints
  else nextOverride.additionalConstraints = remaining

  // An added constraint owns its name, so any overlay entry under it (e.g. the
  // disable flag) is dead once it's gone — prune it, then the map if it empties.
  if (nextOverride.constraintOverrides?.[name]) {
    const map = { ...nextOverride.constraintOverrides }
    delete map[name]
    if (Object.keys(map).length === 0) delete nextOverride.constraintOverrides
    else nextOverride.constraintOverrides = map
  }

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
  value: ConstraintOverride[K]
): MessageImplementationGuide {
  const prev = mig.elementOverrides[path] ?? {}
  const map = prev.constraintOverrides ?? {}
  return {
    ...mig,
    elementOverrides: {
      ...mig.elementOverrides,
      [path]: {
        ...prev,
        constraintOverrides: {
          ...map,
          [name]: { ...map[name], [field]: value },
        },
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
  field: keyof ConstraintOverride
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
