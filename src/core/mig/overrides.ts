import type { ElementOverride, MessageImplementationGuide } from "@/core/types/types"

// Immutable helpers for editing a MIG's element overrides. Override fields are
// tri-state (MIG_FORMAT.md / CLAUDE.md): absent = inherit, `null` = remove the
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
