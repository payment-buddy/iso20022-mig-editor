import type {BusinessArea, DataType, MessageDefinition, MessageImplementationGuide} from "./types.ts";
import {MessageStructure} from "./MessageStructure.tsx";
import {useState} from "react";
import {CreateMigForm} from "./CreateMigForm.tsx";

function versionLabel(msg: MessageDefinition) {
    return 'V' + msg.identifier.substring(msg.identifier.lastIndexOf('.') + 1)
}

export function MessageDetailPage({messageId, versions, businessArea, dataTypes, onMigCreated}: {
    messageId: string | null
    versions: MessageDefinition[]
    businessArea: BusinessArea
    dataTypes: Map<string, DataType>
    onMigCreated: (mig: MessageImplementationGuide) => void
}) {
    const [showMigForm, setShowMigForm] = useState(false)

    let message = versions.find(value => value.identifier === messageId)
    if (!message) {
        message = versions[versions.length - 1]
    }

    function handleMigSave(mig: MessageImplementationGuide) {
        onMigCreated(mig)
        setShowMigForm(false)
    }

    return (
        <div>
            <p><a href="#browse" className="back-link">← Back</a></p>

            <div>
                <div style={{color: '#666', fontSize: '1em'}}>{businessArea.name}</div>
                <div className="page-header">
                    <h2 style={{marginTop: '0.2em'}}>{message.name}
                        <code className="badge">{message.identifier}</code></h2>
                    <div className="page-actions">
                        <button onClick={() => setShowMigForm(v => !v)}>Create MIG</button>
                    </div>
                </div>
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
                        {versionLabel(msg)}
                    </a>
                ))}
            </div>

            {showMigForm && (
                <CreateMigForm message={message} onSave={handleMigSave} onCancel={() => setShowMigForm(false)}/>
            )}

            <p style={{whiteSpace: 'pre-wrap'}}>{message.definition}</p>

            <MessageStructure message={message} dataTypes={dataTypes}/>
        </div>
    )
}