// Persistence for the parsed e-Repository: a single record in IndexedDB.

import type { ERepository } from "@/core/types/types"
import { STORE_EREPOSITORY, withStore } from "./db"

// The e-Repository store holds exactly one record under this fixed key.
const RECORD_KEY = "current"

/** Persist the parsed e-Repository (overwrites the existing one). */
export async function saveERepository(eRepository: ERepository): Promise<void> {
  await withStore(STORE_EREPOSITORY, (s) => s.put(eRepository, RECORD_KEY), "readwrite")
}

/** Load the stored e-Repository, or `null` if none has been uploaded yet. */
export async function loadERepository(): Promise<ERepository | null> {
  const result = await withStore<ERepository | undefined>(STORE_EREPOSITORY, (s) =>
    s.get(RECORD_KEY),
  )
  return result ?? null
}

/** Whether an e-Repository is stored (drives first-run routing without loading the payload). */
export async function hasERepository(): Promise<boolean> {
  const count = await withStore<number>(STORE_EREPOSITORY, (s) => s.count(RECORD_KEY))
  return count > 0
}

/** Remove the stored e-Repository (e.g. before re-uploading a newer file). */
export async function clearERepository(): Promise<void> {
  await withStore(STORE_EREPOSITORY, (s) => s.delete(RECORD_KEY), "readwrite")
}
