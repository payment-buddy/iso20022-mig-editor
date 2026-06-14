import type { MessageImplementationGuide } from "@/core/types/types"

// One-shot handoff of a parsed incoming MIG from the import-duplicate flow to the
// merge screen, so the user doesn't have to re-upload the same file. Kept in
// module state (not a store): it survives the synchronous hash navigation and is
// taken once on the merge screen, keyed by the target it was meant for. A page
// reload clears it — the merge screen then falls back to its own upload.

let pending: {
  targetKey: string
  incoming: MessageImplementationGuide
} | null = null

export function setPendingMerge(
  targetKey: string,
  incoming: MessageImplementationGuide
): void {
  pending = { targetKey, incoming }
}

/** The pending incoming MIG for `targetKey`, if any — without clearing it. */
export function peekPendingMerge(
  targetKey: string
): MessageImplementationGuide | null {
  return pending?.targetKey === targetKey ? pending.incoming : null
}

/** Return and clear the pending incoming MIG, but only if it matches `targetKey`. */
export function takePendingMerge(
  targetKey: string
): MessageImplementationGuide | null {
  const incoming = peekPendingMerge(targetKey)
  if (incoming) pending = null
  return incoming
}
