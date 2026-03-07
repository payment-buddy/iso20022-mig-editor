import type {MessageImplementationGuide} from "./types.ts";

export function MigList({migs, onCreateMig}: { migs: MessageImplementationGuide[], onCreateMig: () => void }) {
    return (
        <div>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                <h2>Message Implementation Guides</h2>
                <button onClick={onCreateMig}>Create MIG</button>
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
