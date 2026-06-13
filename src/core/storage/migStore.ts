// Persistence for MIGs: keyed by `name:version` in the `mig` object store.

import { getMigKey } from "@/core/mig/migKey"
import type { MessageImplementationGuide } from "@/core/types/types"
import { STORE_MIG, withStore } from "./db"

/** Save (insert or replace) a MIG under its `name:version` key. */
export async function saveMig(mig: MessageImplementationGuide): Promise<void> {
  await withStore(STORE_MIG, (s) => s.put(mig, getMigKey(mig)), "readwrite")
}

/** Load every stored MIG. */
export async function loadAllMigs(): Promise<MessageImplementationGuide[]> {
  return withStore<MessageImplementationGuide[]>(STORE_MIG, (s) => s.getAll())
}

/** Load a single MIG by `name:version`, or `null` if absent. */
export async function loadMig(key: string): Promise<MessageImplementationGuide | null> {
  const result = await withStore<MessageImplementationGuide | undefined>(STORE_MIG, (s) =>
    s.get(key),
  )
  return result ?? null
}

/** Delete a MIG by `name:version`. */
export async function deleteMig(key: string): Promise<void> {
  await withStore(STORE_MIG, (s) => s.delete(key), "readwrite")
}
