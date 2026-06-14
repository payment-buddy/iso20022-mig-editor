import { getMigKey } from "./migKey"
import type { MessageImplementationGuide } from "@/core/types/types"

export type RenameResult =
  | { ok: false; error: string }
  | {
      ok: true
      oldKey: string
      newKey: string
      /** `false` when the name and version are unchanged (a no-op). */
      changed: boolean
      renamed: MessageImplementationGuide
      /** Child MIGs whose `parentMIG` pointed at the old key, repointed to the new one. */
      reparented: MessageImplementationGuide[]
    }

/**
 * Compute a MIG rename (a new name and/or version → a new identity key). The
 * identity key is `name:version`, so any change re-keys the MIG. Validates the
 * inputs and rejects a collision with a *different* MIG. Returns the renamed MIG
 * plus any child MIGs whose `parentMIG` must follow it to the new key. Pure — the
 * caller persists (save the renamed + reparented, delete the old key) and
 * re-routes.
 */
export function renameMig(
  allMigs: MessageImplementationGuide[],
  oldKey: string,
  name: string,
  version: string
): RenameResult {
  const trimmedName = name.trim()
  const trimmedVersion = version.trim()
  if (!trimmedName || !trimmedVersion) {
    return { ok: false, error: "Name and version are both required." }
  }

  const mig = allMigs.find((m) => getMigKey(m) === oldKey)
  if (!mig) return { ok: false, error: "This MIG could not be found." }

  const newKey = getMigKey({ name: trimmedName, version: trimmedVersion })
  if (newKey === oldKey) {
    return {
      ok: true,
      oldKey,
      newKey,
      changed: false,
      renamed: mig,
      reparented: [],
    }
  }
  if (allMigs.some((m) => getMigKey(m) === newKey)) {
    return { ok: false, error: `A MIG "${newKey}" already exists.` }
  }

  const renamed: MessageImplementationGuide = {
    ...mig,
    name: trimmedName,
    version: trimmedVersion,
  }
  const reparented = allMigs
    .filter((m) => m.parentMIG === oldKey && getMigKey(m) !== oldKey)
    .map((m) => ({ ...m, parentMIG: newKey }))

  return { ok: true, oldKey, newKey, changed: true, renamed, reparented }
}
