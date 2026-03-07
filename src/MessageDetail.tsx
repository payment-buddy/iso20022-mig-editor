import type {BusinessArea, DataType, MessageDefinition} from "./types.ts";
import {ElementNode} from "./ElementNode.tsx";

function versionLabel(name: string) {
    return name.match(/V\d+$/)?.[0] ?? name
}

export function MessageDetail({messageId, versions, businessArea, dataTypes}: {
    messageId: string | null,
    versions: MessageDefinition[],
    businessArea: BusinessArea
    dataTypes: Map<string, DataType>
}) {
    let message = versions.find(value => value.identifier === messageId)
    if (!message) {
        message = versions[versions.length - 1]
    }

    return (
        <div>
            <p><a href="#">← Back</a></p>

            <div>
                <div style={{color: '#666', fontSize: '1em'}}>{businessArea.name}</div>
                <h3 style={{marginTop: '0.2em'}}>{message.name}</h3>
            </div>

            <div style={{display: 'flex', gap: '0.4rem', marginBottom: '1rem'}}>
                {versions.map((msg) => (
                    <a href={'#' + msg.identifier}
                       key={msg.identifier}
                       style={{
                           padding: '0.2em 0.6em', borderRadius: 4, fontSize: '0.8em',
                           cursor: 'pointer', border: '1px solid #2b5ce6',
                           background: msg === message ? '#2b5ce6' : 'transparent',
                           color: msg === message ? '#fff' : '#2b5ce6',
                       }}
                    >
                        {versionLabel(msg.name)}
                    </a>
                ))}
            </div>

            <p style={{whiteSpace: 'pre-wrap'}}>{message.definition}</p>

            <ul style={{paddingLeft: 0, listStyle: 'none'}}>
                {message.blocks.map((block, i) => (
                    <ElementNode key={i} element={block} dataTypes={dataTypes}/>
                ))}
            </ul>
        </div>
    )
}