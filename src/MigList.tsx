import type {MessageImplementationGuide} from "./types.ts";
import {useRef} from "react";

export function MigList({migs, onBrowse, onUpload, onDownload}: {
    migs: MessageImplementationGuide[]
    onBrowse: () => void
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
            <div className="page-header">
                <h2>ISO 20022 Message Implementation Guide</h2>
                <div className="page-actions">
                    <input ref={fileInputRef} type="file" accept=".yaml,.yml" style={{display: 'none'}}
                           onChange={handleFileChange}/>
                    {migs.length > 0 && <button onClick={onDownload}>Download all</button>}
                    <button onClick={() => fileInputRef.current?.click()}>Load MIG</button>
                    <button onClick={onBrowse}>Browse e-Repository</button>
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
                        <td><a href={'#mig/' + mig.id}>{mig.messageIdentifier}</a></td>
                        <td><a href={'#mig/' + mig.id}>{mig.name}</a></td>
                        <td>{mig.version}</td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    )
}
