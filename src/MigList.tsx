import type {MessageImplementationGuide} from "./types.ts";
import {useRef} from "react";

export function MigList({migs, onCreateMig, onUpload, onDownload}: {
    migs: MessageImplementationGuide[]
    onCreateMig: () => void
    onUpload: (text: string) => void
    onDownload: () => void
}) {
    const fileInputRef = useRef<HTMLInputElement>(null)

    function handleFileChange(e: { target: HTMLInputElement }) {
        const file = e.target.files?.[0]
        if (!file) return
        file.text().then(onUpload)
        e.target.value = ''
    }

    return (
        <div>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                <h2>Message Implementation Guides</h2>
                <div style={{display: 'flex', gap: '0.5rem'}}>
                    <input ref={fileInputRef} type="file" accept=".yaml,.yml" style={{display: 'none'}}
                           onChange={handleFileChange}/>
                    <button onClick={onDownload}>Download all</button>
                    <button onClick={() => fileInputRef.current?.click()}>Upload MIG</button>
                    <button onClick={onCreateMig}>Create MIG</button>
                </div>
            </div>
            <table style={{width: '100%', borderCollapse: 'collapse'}}>
                <thead>
                <tr style={{textAlign: 'left', borderBottom: '2px solid'}}>
                    <th>Message</th>
                    <th>Name</th>
                    <th>Version</th>
                </tr>
                </thead>
                <tbody>
                {migs.map(mig => (
                    <tr key={mig.id} style={{borderBottom: '1px solid'}}>
                        <td>{mig.messageIdentifier}</td>
                        <td>{mig.name}</td>
                        <td>{mig.version}</td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    )
}
