import {stringify} from "yaml";
import type {MessageImplementationGuideline} from "./types.ts";

export function MigDetail({mig}: { mig: MessageImplementationGuideline }) {
    function handleDownload() {
        const blob = new Blob([stringify(mig)], {type: 'text/yaml'})
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${mig.messageIdentifier}-${mig.name}-${mig.version}.yaml`
        a.click()
    }

    return (
        <div>
            <p><a href="#">← Back</a></p>

            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                <h2 style={{margin: 0}}>{mig.name}</h2>
                <button onClick={handleDownload}>Download</button>
            </div>
            <div>
                {mig.messageIdentifier}
            </div>
            <div>
                {mig.version}
            </div>

            {mig.description && (
                <p style={{whiteSpace: 'pre-wrap'}}>{mig.description}</p>
            )}
        </div>
    )
}
