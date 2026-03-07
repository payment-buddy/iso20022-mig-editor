import {FileUploader} from './FileUploader'
import {useState} from "react";
import type {BusinessArea, ERepository} from "./eRepository.ts";

function App() {
    const [businessAreas, setBusinessAreas] = useState<BusinessArea[]>([])

    function handleParsed(eRepository: ERepository) {
        setBusinessAreas(eRepository.businessAreas)
    }

    return (
        <>
            <h1>ISO 20022 Explorer</h1>
            <FileUploader onParsed={handleParsed}/>
            <ul>
                {businessAreas.map((ba) => {
                    return (
                        <li key={ba.code}>{ba.name}</li>
                    )
                })}
            </ul>
        </>
    )
}

export default App
