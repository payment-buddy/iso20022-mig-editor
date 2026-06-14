// Persistence for a MIG's revision history: one `Revision[]` per MIG, keyed by
// the MIG's `name:version` in the `revision` object store.

import type { Revision } from "@/core/mig/revisions"
import { STORE_REVISION, withStore } from "./db"

/**
 * The most recent revision timestamp for every MIG that has history, keyed by
 * `name:version` (for a "last modified" column). MIGs with no history are absent.
 */
export async function loadLatestRevisionTimes(): Promise<
  Record<string, number>
> {
  const [keys, lists] = await Promise.all([
    withStore<IDBValidKey[]>(STORE_REVISION, (s) => s.getAllKeys()),
    withStore<Revision[][]>(STORE_REVISION, (s) => s.getAll()),
  ])
  const out: Record<string, number> = {}
  keys.forEach((key, i) => {
    const revs = lists[i]
    if (revs && revs.length > 0) out[String(key)] = revs[revs.length - 1].at
  })
  return out
}

/** Load a MIG's revisions (oldest → newest), or `[]` if none. */
export async function loadRevisions(key: string): Promise<Revision[]> {
  const result = await withStore<Revision[] | undefined>(STORE_REVISION, (s) =>
    s.get(key)
  )
  return result ?? []
}

/** Replace a MIG's revision list. */
export async function saveRevisions(
  key: string,
  revisions: Revision[]
): Promise<void> {
  await withStore(STORE_REVISION, (s) => s.put(revisions, key), "readwrite")
}

/** Drop a MIG's revision history (e.g. when the MIG is deleted). */
export async function deleteRevisions(key: string): Promise<void> {
  await withStore(STORE_REVISION, (s) => s.delete(key), "readwrite")
}

/** Move a MIG's history to a new key (on a name/version re-key). No-op if empty. */
export async function renameRevisions(
  oldKey: string,
  newKey: string
): Promise<void> {
  if (oldKey === newKey) return
  const revisions = await loadRevisions(oldKey)
  if (revisions.length === 0) return
  await saveRevisions(newKey, revisions)
  await deleteRevisions(oldKey)
}
