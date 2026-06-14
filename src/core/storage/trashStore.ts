// Persistence for soft-deleted ("trashed") MIGs. Each trash record is
// self-contained — the MIG, its revision history, and a `deletedAt` timestamp —
// keyed by `name:version` in the `trash` object store. Deleting a MIG moves it
// here (out of the active mig/revision stores); restoring writes it (and its
// history) back; purging/emptying removes it for good. Retention is manual: the
// trash is only cleared by the user (no auto-purge).

import { getMigKey } from "@/core/mig/migKey"
import type { Revision } from "@/core/mig/revisions"
import type { MessageImplementationGuide } from "@/core/types/types"
import { STORE_TRASH, withStore } from "./db"
import { deleteMig, loadMig, saveMig } from "./migStore"
import { deleteRevisions, loadRevisions, saveRevisions } from "./revisionStore"

export type TrashedMig = {
  mig: MessageImplementationGuide
  revisions: Revision[]
  /** When it was moved to the trash (`Date.now()`). */
  deletedAt: number
}

/** All trashed MIGs, newest deletion first. */
export async function loadTrash(): Promise<TrashedMig[]> {
  const all = await withStore<TrashedMig[]>(STORE_TRASH, (s) => s.getAll())
  return all.sort((a, b) => b.deletedAt - a.deletedAt)
}

/** How many MIGs are in the trash. */
export async function loadTrashCount(): Promise<number> {
  return withStore<number>(STORE_TRASH, (s) => s.count())
}

/**
 * Move a MIG (and its revision history) into the trash, removing it from the
 * active mig/revision stores. No-op if the MIG isn't found.
 */
export async function trashMig(key: string, deletedAt: number): Promise<void> {
  const mig = await loadMig(key)
  if (!mig) return
  const revisions = await loadRevisions(key)
  await withStore(STORE_TRASH, (s) => s.put({ mig, revisions, deletedAt }, key), "readwrite")
  await deleteMig(key)
  await deleteRevisions(key)
}

/** Restore a trashed MIG (and its history) to the active stores. No-op if absent. */
export async function restoreFromTrash(key: string): Promise<void> {
  const record = await withStore<TrashedMig | undefined>(STORE_TRASH, (s) => s.get(key))
  if (!record) return
  await saveMig(record.mig)
  if (record.revisions.length > 0) await saveRevisions(getMigKey(record.mig), record.revisions)
  await withStore(STORE_TRASH, (s) => s.delete(key), "readwrite")
}

/** Permanently delete one trashed MIG. */
export async function purgeFromTrash(key: string): Promise<void> {
  await withStore(STORE_TRASH, (s) => s.delete(key), "readwrite")
}

/** Permanently delete every trashed MIG. */
export async function emptyTrash(): Promise<void> {
  await withStore(STORE_TRASH, (s) => s.clear(), "readwrite")
}
