import {FileUploader} from './FileUploader'
import {useState} from "react";
import type {BusinessArea, ERepository} from "./eRepository.ts";
import {BusinessAreaList} from './BusinessAreaList'

function App() {
    const [businessAreas, setBusinessAreas] = useState<BusinessArea[]>([])

    function handleParsed(eRepository: ERepository) {
        setBusinessAreas(eRepository.businessAreas)
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
