import {FileUploader} from './FileUploader'
import {useState} from "react";
import type {BusinessArea, ERepository} from "./eRepository.ts";
import {BusinessAreaList} from './BusinessAreaList'
import {MessageDetail} from './MessageDetail.tsx'
import {useHash} from "./useHash.ts";

function App() {
    const [businessAreas, setBusinessAreas] = useState<BusinessArea[]>([])
    const hash = useHash()

    function handleParsed(eRepository: ERepository) {
        setBusinessAreas(eRepository.businessAreas)
    }

    function getView() {
        if (hash.startsWith('#')) {
            const code = hash.substring(1)
            for (const businessArea of businessAreas) {
                for (const message of businessArea.messages) {
                    if (message.identifier === code) {
                        return <MessageDetail messageId={message.identifier} versions={businessArea.messages.filter(msg => msg.shortCode === message.shortCode)} businessArea={businessArea}/>
                    }
                }
                for (const message of businessArea.messages) {
                    if (message.shortCode === code) {
                        return <MessageDetail messageId={null} versions={businessArea.messages.filter(msg => msg.shortCode === code)} businessArea={businessArea}/>
                    }
                }
            }
        }
        if (businessAreas.length > 0) {
            return <BusinessAreaList businessAreas={businessAreas}/>
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
