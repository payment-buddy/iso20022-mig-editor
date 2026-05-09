import {RepositoryUploadPage} from './pages/RepositoryUploadPage.tsx'
import {useEffect, useState} from "react"
import {parseRepository} from "./services/eRepository.ts"
import {BusinessAreaListPage} from './pages/BusinessAreaListPage'
import {MigListPage} from './pages/MigListPage.tsx'
import {MessageDetailPage} from './pages/MessageDetailPage.tsx'
import {MigDetailPage} from './pages/MigDetailPage.tsx'
import {useHash} from "./hooks/useHash.ts"
import type {ERepository, MessageImplementationGuide} from "./types/types.ts"
import {
    deleteDatabase,
    deleteMig,
    loadAllMigs,
    loadERepository,
    loadMigsForBackup,
    saveERepository,
    saveMig
} from "./services/localStore.ts"
import {parse} from "yaml"
import {downloadYaml} from "./utils/downloadYaml"
import {prepareForDownload} from "./utils/migUtils"
import {DuplicateConfirmModal} from "./components/DuplicateConfirmModal"

function App() {
    const [eRepository, setERepository] = useState<ERepository | null>(null)
    const [migs, setMigs] = useState<MessageImplementationGuide[]>([])
    const [loading, setLoading] = useState(true)
    const [dbError, setDbError] = useState(false)
    const [duplicateConfirm, setDuplicateConfirm] = useState<{
        incoming: MessageImplementationGuide[]
        duplicates: MessageImplementationGuide[]
    } | null>(null)
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

    function handleBrowse() {
        window.location.hash = 'browse'
    }

    function handleUpdateERepository(file: File) {
        void parseRepository(file).then(handleParsed)
    }


    function handleMigUpload(text: string) {
        const parsed: unknown = parse(text)
        const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed]
        const incoming = items.map((item) => {
            const obj = item as Record<string, unknown>
            return {
                ...obj,
                id: typeof obj.id === 'string' ? obj.id : crypto.randomUUID()
            } as MessageImplementationGuide
        })

        const existingIds = new Set(migs.map(m => m.id))
        const duplicates = incoming.filter(m => existingIds.has(m.id))

        if (duplicates.length > 0) {
            setDuplicateConfirm({incoming, duplicates})
            return
        }

        saveAndUpdate(incoming)
    }

    function saveAndUpdate(migList: MessageImplementationGuide[]) {
        void Promise.all(migList.map(saveMig)).then(() => {
            setMigs(prev => {
                const savedIds = new Set(migList.map(m => m.id))
                return [...prev.filter(m => !savedIds.has(m.id)), ...migList]
            })
            if (migList.length === 1) {
                window.location.hash = 'mig/' + migList[0].id
            }
        })
    }

    function handleDuplicateOverwrite() {
        if (!duplicateConfirm) return
        const {incoming} = duplicateConfirm
        setDuplicateConfirm(null)
        saveAndUpdate(incoming)
    }

    function handleDuplicateSkip() {
        if (!duplicateConfirm) return
        const {incoming, duplicates} = duplicateConfirm
        const duplicateIds = new Set(duplicates.map(m => m.id))
        const newOnes = incoming.filter(m => !duplicateIds.has(m.id))
        setDuplicateConfirm(null)
        saveAndUpdate(newOnes)
    }

    function handleMigUpdated(updated: MessageImplementationGuide) {
        void saveMig(updated).then(() => {
            setMigs(prev => prev.map(m => m.id === updated.id ? updated : m))
        })
    }

    function handleMigDeleted(id: string) {
        void deleteMig(id).then(() => {
            setMigs(prev => prev.filter(m => m.id !== id))
            window.location.hash = ''
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
        await downloadYaml(prepareForDownload(migs), 'mig-backup.yaml')
    }

    function handleDeleteDatabase() {
        void deleteDatabase().then(() => {
            setDbError(false)
            setERepository(null)
            setMigs([])
        })
    }

    if (loading) {
        return null
    }
    if (dbError) {
        return (
            <div className="error-box">
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
        return <RepositoryUploadPage onParsed={handleParsed}/>
    }
    if (hash === '#browse') {
        return <BusinessAreaListPage businessAreas={eRepository.businessAreas} onUpdateERepository={handleUpdateERepository}/>
    }
    if (hash.startsWith('#mig/')) {
        const id = hash.substring(5)
        const mig = migs.find(m => m.id === id)
        if (mig) return <MigDetailPage mig={mig}
                                       migs={migs}
                                       eRepository={eRepository}
                                       onUpdate={handleMigUpdated}
                                       onDelete={handleMigDeleted}/>
    }
    if (hash.startsWith('#')) {
        const code = hash.substring(1)
        for (const businessArea of eRepository.businessAreas) {
            for (const message of businessArea.messages) {
                if (message.identifier === code) {
                    return <MessageDetailPage messageId={message.identifier}
                                          versions={businessArea.messages.filter(msg => msg.shortCode === message.shortCode)}
                                          businessArea={businessArea}
                                          dataTypes={eRepository.dataTypes}
                                          onMigCreated={handleMigCreated}/>
                }
            }
            for (const message of businessArea.messages) {
                if (message.shortCode === code) {
                    return <MessageDetailPage messageId={null}
                                          versions={businessArea.messages.filter(msg => msg.shortCode === code)}
                                          businessArea={businessArea}
                                          dataTypes={eRepository.dataTypes}
                                          onMigCreated={handleMigCreated}/>
                }
            }
        }
    }
    return (
        <>
            <MigListPage migs={migs} onBrowse={handleBrowse} onUpload={handleMigUpload}/>
            {duplicateConfirm && (
                <DuplicateConfirmModal
                    duplicates={duplicateConfirm.duplicates}
                    onSkip={handleDuplicateSkip}
                    onOverwrite={handleDuplicateOverwrite}
                />
            )}
        </>
    )
}

export default App
