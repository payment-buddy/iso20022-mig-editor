import {FileUploader} from './FileUploader'
import {useState} from "react";
import type {BusinessArea, ERepository} from "./eRepository.ts";
import {BusinessAreaList} from './BusinessAreaList'
import {BusinessAreaPage} from './BusinessAreaPage'
import {useHash} from "./useHash.ts";

function App() {
    const [businessAreas, setBusinessAreas] = useState<BusinessArea[]>([])
    const hash = useHash()

    function handleParsed(eRepository: ERepository) {
        setBusinessAreas(eRepository.businessAreas)
    }

    if (hash.startsWith('#')) {
        const code = hash.substring(1)
        const businessArea = businessAreas.find(ba => ba.code === code)
        if (businessArea) {
            return <BusinessAreaPage businessArea={businessArea}/>
        }
    }

    return (
        <>
            <h1>ISO 20022 Explorer</h1>

            {businessAreas.length === 0 && (
                <FileUploader onParsed={handleParsed}/>
            )}

            <BusinessAreaList businessAreas={businessAreas}/>
        </>
    )
}

export default App
