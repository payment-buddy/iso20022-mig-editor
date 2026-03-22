import type {MessageImplementationGuide} from "./types.ts";
import {FileInputButton} from "./FileInputButton.tsx";

export function MigList({migs, onBrowse, onUpload, onDownload}: {
    migs: MessageImplementationGuide[]
    onBrowse: () => void
    onUpload: (text: string) => void
    onDownload: () => void
}) {
    return (
        <div>
            <div className="page-header">
                <h2>ISO 20022 Message Implementation Guide</h2>
                <div className="page-actions">
                    {migs.length > 0 && <button onClick={onDownload}>Download all</button>}
                    <FileInputButton label="Load MIG" accept=".yaml,.yml" onFile={f => f.text().then(onUpload)}/>
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
