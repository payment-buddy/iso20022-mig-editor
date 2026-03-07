import type {BusinessArea, MessageDefinition} from './eRepository.ts'

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

export function BusinessAreaList({businessAreas}: { businessAreas: BusinessArea[] }) {
    return (
        <ul style={{listStyle: 'none', paddingLeft: 0}}>
            {businessAreas.map((ba) => {
                const groups = groupByBase(ba.messages)
                return (
                    <li key={ba.code}>
                        <h4>{ba.name} <code style={{
                            marginLeft: '0.2rem',
                            background: '#999', color: '#333',
                            padding: '0.1em 0.4em', borderRadius: 3, fontSize: '1em',
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
                                                background: '#999', color: '#333',
                                                padding: '0.1em 0.4em', borderRadius: 3, fontSize: '1em',
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
    )
}