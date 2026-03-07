import type {ERepository, MessageImplementationGuide} from "./types.ts"

const DB_NAME = 'iso20022'
const DB_VERSION = 1
const RECORD_KEY = 'current'

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)
        request.onupgradeneeded = () => {
            const db = request.result
            db.createObjectStore('eRepository')
            db.createObjectStore('mig')
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

async function request<T>(storeName: string, fn: (store: IDBObjectStore) => IDBRequest<T>, mode: IDBTransactionMode): Promise<T> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode)
        const store = tx.objectStore(storeName)
        const req = fn(store)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

export async function saveERepository(eRepository: ERepository): Promise<void> {
    await request("eRepository", store => store.put(eRepository, RECORD_KEY), 'readwrite')
}

export async function loadERepository(): Promise<ERepository | null> {
    return request("eRepository", store => store.get(RECORD_KEY), 'readonly').then(r => r ?? null)
}

export async function saveMig(mig: MessageImplementationGuide): Promise<void> {
    await request("mig", store => store.put(mig, mig.id), 'readwrite')
}

export async function loadAllMigs(): Promise<MessageImplementationGuide[]> {
    return request("mig", store => store.getAll(), 'readonly')
}

export async function deleteMig(id: string): Promise<void> {
    await request("mig", store => store.delete(id), 'readwrite')
}

export function deleteDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase(DB_NAME)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
    })
}
