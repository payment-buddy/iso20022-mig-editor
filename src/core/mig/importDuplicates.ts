// Duplicate handling for MIG import. Incoming MIGs are keyed
// by `name:version`; when a key already exists the user resolves how to bring it
// in — skip the duplicates, upload them as a new (version-bumped) identity, or
// overwrite the existing ones. Pure; the dialog/list wiring lives in the UI.

import { getMigKey } from "./migKey"
import type { MessageImplementationGuide } from "@/core/types/types"

export type DuplicateResolution = "skip" | "overwrite" | "new"

/** Keys among `incoming` that already exist in `existing`. */
export function duplicateKeysOf(
  incoming: MessageImplementationGuide[],
  existing: Iterable<string>
): Set<string> {
  const have = new Set(existing)
  return new Set(incoming.map(getMigKey).filter((k) => have.has(k)))
}

/**
 * The MIGs to persist for a chosen resolution:
 * - `skip` — only the non-duplicate (new) incoming MIGs; existing ones untouched.
 * - `overwrite` — every incoming MIG, replacing the same-key existing ones.
 * - `new` — duplicates re-versioned to `<version>-<timestamp>` (a fresh identity,
 *   leaving the existing one intact), plus the non-duplicates unchanged.
 *
 * `timestamp` is passed in (not read from the clock) so the result is pure.
 */
export function migsForResolution(
  incoming: MessageImplementationGuide[],
  duplicateKeys: Set<string>,
  resolution: DuplicateResolution,
  timestamp: number
): MessageImplementationGuide[] {
  switch (resolution) {
    case "overwrite":
      return incoming
    case "skip":
      return incoming.filter((m) => !duplicateKeys.has(getMigKey(m)))
    case "new":
      return incoming.map((m) =>
        duplicateKeys.has(getMigKey(m))
          ? { ...m, version: `${m.version}-${timestamp}` }
          : m
      )
  }
}
