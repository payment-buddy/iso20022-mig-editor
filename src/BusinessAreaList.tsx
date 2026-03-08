import type {BusinessArea, MessageDefinition} from "./types.ts";
import {useRef} from "react";

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
    const fileInputRef = useRef<HTMLInputElement>(null)

    return (
        <>
            <p><a href="#">← Back</a></p>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                <h2>ISO 20022 e-Repository</h2>
                <input ref={fileInputRef} type="file" accept=".iso20022,.zip" style={{display: 'none'}}
                       onChange={e => {
                           const f = e.target.files?.[0];
                           if (f) onUpdateERepository(f);
                           e.target.value = ''
                       }}/>
                <button onClick={() => fileInputRef.current?.click()}>Update e-Repository</button>
            </div>
            <ul style={{listStyle: 'none', paddingLeft: 0}}>
                {businessAreas.map((ba) => {
                    const groups = groupByBase(ba.messages)
                    return (
                        <li key={ba.code}>
                            <h4>{ba.name} <code style={{
                                marginLeft: '0.2rem',
                                padding: '0.1em 0.4em',
                                border: '#999 solid 1px',
                                borderRadius: 3,
                                fontSize: '1em',
                            }}>{ba.code}</code></h4>
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
                                                <code style={{
                                                    marginLeft: '0.2rem',
                                                    padding: '0.1em 0.4em',
                                                    border: '#999 solid 1px',
                                                    borderRadius: 3,
                                                    fontSize: '1em',
                                                }}>{versions[0].shortCode}</code>
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