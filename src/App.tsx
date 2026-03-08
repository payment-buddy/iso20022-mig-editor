import {FileUploader} from './FileUploader'
import {useEffect, useState} from "react";
import {BusinessAreaList} from './BusinessAreaList'
import {MigList} from './MigList.tsx'
import {MessageDetail} from './MessageDetail.tsx'
import {useHash} from "./useHash.ts";
import type {ERepository, MessageImplementationGuide} from "./types.ts";
import {
    deleteDatabase,
    loadAllMigs,
    loadERepository,
    loadMigsForBackup,
    saveERepository,
    saveMig
} from "./localStore.ts";
import {parse, stringify} from "yaml";

function App() {
    const [eRepository, setERepository] = useState<ERepository | null>(null)
    const [migs, setMigs] = useState<MessageImplementationGuide[]>([])
    const [loading, setLoading] = useState(true)
    const [dbError, setDbError] = useState(false)
    const hash = useHash()

    useEffect(() => {
        void Promise.all([loadERepository(), loadAllMigs()]).then(([stored, migs]) => {
            setERepository(stored)
            setMigs(migs)
            setLoading(false)
        }).catch(() => {
            setLoading(false)
            setDbError(true)
        })
    }, [])

    function handleParsed(eRepository: ERepository) {
        void saveERepository(eRepository)
        setERepository(eRepository)
    }

    function handleMigDownload() {
        const yaml = stringify(migs)
        const blob = new Blob([yaml], {type: 'text/yaml'})
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'migs.yaml'
        a.click()
        URL.revokeObjectURL(url)
    }

    function handleMigUpload(text: string) {
        const parsed: unknown = parse(text)
        const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed]
        const incoming = items.map((item) => {
            const obj = item as Record<string, unknown>
            return {...obj, id: typeof obj.id === 'string' ? obj.id : crypto.randomUUID()} as MessageImplementationGuide
        })
        void Promise.all(incoming.map(saveMig)).then(() => {
            setMigs(prev => {
                const existingIds = new Set(prev.map(m => m.id))
                return [...prev, ...incoming.filter(m => !existingIds.has(m.id))]
            })
        })
    }

    function handleMigCreated(mig: MessageImplementationGuide) {
        void saveMig(mig).then(() => {
            setMigs(prev => [...prev, mig])
            window.location.hash = 'mig/' + mig.id
        })
    }

    async function handleDownloadMigBackup() {
        const migs = await loadMigsForBackup()
        const yaml = stringify(migs)
        const blob = new Blob([yaml], {type: 'text/yaml'})
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'mig-backup.yaml'
        a.click()
        URL.revokeObjectURL(url)
    }

    function handleDeleteDatabase() {
        void deleteDatabase().then(() => {
            setDbError(false)
            setERepository(null)
            setMigs([])
        })
    }

    function getView() {
        if (loading) return null
        if (dbError) {
            return (
                <div style={{border: '1px solid #c00', padding: '1rem', maxWidth: 480}}>
                    <p><strong>Failed to open the local database.</strong> This can happen after an app update that
                        changed the data format.</p>
                    <p>You can delete all stored data and start fresh, or downgrade to an older version of the app that
                        is compatible with your data.</p>
                    <button onClick={() => handleDownloadMigBackup()}>Download MIG backup</button>
                    <button onClick={handleDeleteDatabase}>Delete stored data</button>
                </div>
            )
        }
        if (!eRepository) {
            return <FileUploader onParsed={handleParsed}/>
        }
        if (hash === '#browse') {
            return <BusinessAreaList businessAreas={eRepository.businessAreas}/>
        }
        if (hash.startsWith('#')) {
            const code = hash.substring(1)
            for (const businessArea of eRepository.businessAreas) {
                for (const message of businessArea.messages) {
                    if (message.identifier === code) {
                        return <MessageDetail messageId={message.identifier}
                                              versions={businessArea.messages.filter(msg => msg.shortCode === message.shortCode)}
                                              businessArea={businessArea}
                                              dataTypes={eRepository.dataTypes}
                                              onMigCreated={handleMigCreated}/>
                    }
                }
                for (const message of businessArea.messages) {
                    if (message.shortCode === code) {
                        return <MessageDetail messageId={null}
                                              versions={businessArea.messages.filter(msg => msg.shortCode === code)}
                                              businessArea={businessArea}
                                              dataTypes={eRepository.dataTypes}
                                              onMigCreated={handleMigCreated}/>
                    }
                }
            }
        }
        return <MigList migs={migs} onBrowse={() => { window.location.hash = 'browse' }} onUpload={handleMigUpload} onDownload={handleMigDownload}/>
    }

    return (
        <>
            <h1>ISO 20022 Explorer</h1>
            {getView()}
        </>
    )
}

export default App
