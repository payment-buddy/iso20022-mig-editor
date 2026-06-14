// Raw IndexedDB wrapper (no dependency). One database, four object stores.

const DB_NAME = "iso20022"
const DB_VERSION = 2

export const STORE_EREPOSITORY = "eRepository"
export const STORE_MIG = "mig"
export const STORE_REVISION = "revision"
export const STORE_TRASH = "trash"

let dbPromise: Promise<IDBDatabase> | null = null

/** Open (and cache) the shared connection, creating the schema on first run. */
export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment"))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      // eRepository: single record (key RECORD_KEY). mig/revision: keyed records.
      if (!db.objectStoreNames.contains(STORE_EREPOSITORY)) {
        db.createObjectStore(STORE_EREPOSITORY)
      }
      if (!db.objectStoreNames.contains(STORE_MIG)) {
        db.createObjectStore(STORE_MIG)
      }
      if (!db.objectStoreNames.contains(STORE_REVISION)) {
        db.createObjectStore(STORE_REVISION)
      }
      // v2: soft-deleted MIGs (a self-contained record per key — see trashStore).
      if (!db.objectStoreNames.contains(STORE_TRASH)) {
        db.createObjectStore(STORE_TRASH)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  // If opening fails, drop the cached rejection so a later call can retry.
  dbPromise.catch(() => {
    dbPromise = null
  })
  return dbPromise
}

/** Close the cached connection (required before deleting the database). */
export async function closeDB(): Promise<void> {
  if (!dbPromise) return
  const pending = dbPromise
  dbPromise = null
  try {
    const db = await pending
    db.close()
  } catch {
    // open failed; nothing to close
  }
}

/**
 * Run a single-store transaction and resolve with the request's result.
 * `mode` defaults to "readonly"; pass "readwrite" for mutations.
 */
export async function withStore<T>(
  storeName: string,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
  mode: IDBTransactionMode = "readonly"
): Promise<T> {
  const db = await openDB()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const req = fn(tx.objectStore(storeName))
    req.onsuccess = () => resolve(req.result)
    tx.onerror = () => reject(tx.error ?? req.error)
    req.onerror = () => reject(req.error)
  })
}

/** Delete the entire database (recovery / "start fresh"). Closes the connection first. */
export async function deleteDatabase(): Promise<void> {
  await closeDB()
  return new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    // If another tab holds the connection, resolve once it's gone rather than hang.
    req.onblocked = () => resolve()
  })
}
