import type {ERepository} from "./types.ts"

const DB_NAME = 'iso20022'
const DB_VERSION = 1
const STORE_NAME = 'eRepository'
const RECORD_KEY = 'current'

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)
        request.onupgradeneeded = () => {
            request.result.createObjectStore(STORE_NAME)
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

export async function saveERepository(repo: ERepository): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).put(repo, RECORD_KEY)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

export async function loadERepository(): Promise<ERepository | null> {
    try {
        const db = await openDB()
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly')
            const request = tx.objectStore(STORE_NAME).get(RECORD_KEY)
            request.onsuccess = () => resolve(request.result ?? null)
            request.onerror = () => reject(request.error)
        })
    } catch {
        return null
    }
}
