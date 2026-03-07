import {FileUploader} from './FileUploader'
import {useState} from "react";
import {BusinessAreaList} from './BusinessAreaList'
import {MessageDetail} from './MessageDetail.tsx'
import {useHash} from "./useHash.ts";
import type {ERepository} from "./types.ts";

function App() {
    const [eRepository, setERepository] = useState<ERepository | null>(null)
    const hash = useHash()

    function handleParsed(eRepository: ERepository) {
        setERepository(eRepository)
    }

    function getView() {
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
