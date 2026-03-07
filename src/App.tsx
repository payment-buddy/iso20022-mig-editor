import {FileUploader} from './FileUploader'
import {useEffect, useState} from "react";
import {BusinessAreaList} from './BusinessAreaList'
import {MessageDetail} from './MessageDetail.tsx'
import {useHash} from "./useHash.ts";
import type {ERepository, MessageImplementationGuide} from "./types.ts";
import {deleteDatabase, loadAllMigs, loadERepository, saveERepository} from "./localStore.ts";

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
                    <p><strong>Failed to open the local database.</strong> This can happen after an app update that changed the data format.</p>
                    <p>You can delete all stored data and start fresh, or downgrade to an older version of the app that is compatible with your data.</p>
                    <button onClick={handleDeleteDatabase}>Delete stored data</button>
                </div>
            )
        }
        if (hash.startsWith('#') && eRepository) {
            const code = hash.substring(1)
            for (const businessArea of eRepository.businessAreas) {
                for (const message of businessArea.messages) {
                    if (message.identifier === code) {
                        return <MessageDetail messageId={message.identifier} versions={businessArea.messages.filter(msg => msg.shortCode === message.shortCode)} businessArea={businessArea} dataTypes={eRepository.dataTypes}/>
                    }
                }
                for (const message of businessArea.messages) {
                    if (message.shortCode === code) {
                        return <MessageDetail messageId={null} versions={businessArea.messages.filter(msg => msg.shortCode === code)} businessArea={businessArea} dataTypes={eRepository.dataTypes}/>
                    }
                }
            }
        }
        if (eRepository) {
            return <BusinessAreaList businessAreas={eRepository.businessAreas}/>
        }
        return <FileUploader onParsed={handleParsed}/>
    }

    return (
        <>
            <h1>ISO 20022 Explorer</h1>
            {getView()}
        </>
    )
}

export default App
