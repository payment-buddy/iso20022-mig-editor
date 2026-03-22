import type {BusinessArea, MessageDefinition} from "./types.ts";
import {FileInputButton} from "./FileInputButton.tsx";

function baseName(name: string) {
    return name.replace(/V\d+$/, '')
}

function versionNumber(name: string) {
    return Number(name.match(/V(\d+)$/)?.[1] ?? 0)
}

function groupByBase(messages: MessageDefinition[]) {
    const map = new Map<string, MessageDefinition[]>()
    for (const msg of messages) {
        const key = baseName(msg.name)
        let versions = map.get(key);
        if (versions === undefined) {
            versions = []
            map.set(key, versions)
        }
        versions.push(msg)
    }
    return Array.from(map.values()).map(
        versions => versions.slice().sort((a, b) => versionNumber(a.name) - versionNumber(b.name))
    )
}

export function BusinessAreaList({businessAreas, onUpdateERepository}: {
    businessAreas: BusinessArea[]
    onUpdateERepository: (file: File) => void
}) {
    return (
        <>
            <a href="#" className="back-link">← Back</a>
            <div className="page-header">
                <h2>ISO 20022 e-Repository</h2>
                <div className="page-actions">
                    <FileInputButton label="Update e-Repository" accept=".iso20022,.zip" onFile={onUpdateERepository}/>
                </div>
            </div>
            <ul style={{listStyle: 'none', paddingLeft: 0}}>
                {businessAreas.map((ba) => {
                    const groups = groupByBase(ba.messages)
                    return (
                        <li key={ba.code}>
                            <h4>{ba.name} <code className="badge">{ba.code}</code></h4>
                            <p>{ba.definition}</p>
                            <details>
                                <summary style={{cursor: 'pointer'}}>
                                    {groups.length} message definitions
                                </summary>
                                <ul style={{listStyle: 'none'}}>
                                    {groups.map((versions) => (
                                        <li key={versions[0].identifier}>
                                            <a href={'#' + versions[0].shortCode}>
                                                <code>{baseName(versions[0].name)}</code>
                                                <code className="badge">{versions[0].shortCode}</code>
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        </li>
                    )
                })}
            </ul>
        </>
    )
}