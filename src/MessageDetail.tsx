import type {BusinessArea, DataType, MessageDefinition, MessageImplementationGuide} from "./types.ts";
import {MessageStructure} from "./MessageStructure.tsx";
import {exportMessageDefinition} from "./messageExport.ts";
import {useState} from "react";

function versionLabel(name: string) {
    return name.match(/V\d+$/)?.[0] ?? name
}

function MigForm({messageIdentifier, onSave, onCancel}: {
    messageIdentifier: string
    onSave: (mig: MessageImplementationGuide) => void
    onCancel: () => void
}) {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [version, setVersion] = useState('')

    function handleSubmit(e: { preventDefault(): void }) {
        e.preventDefault()
        const mig: MessageImplementationGuide = {
            id: crypto.randomUUID(),
            name: name.trim(),
            description: description.trim() || null,
            version: version.trim(),
            messageIdentifier,
            elementOverrides: [],
            additionalConstraints: [],
        }
        onSave(mig)
    }

    const fieldStyle = {display: 'flex', flexDirection: 'column' as const, gap: '0.2rem'}
    const inputStyle = {padding: '0.3em 0.5em', fontSize: '1em', width: '100%', boxSizing: 'border-box' as const}

    return (
        <form onSubmit={handleSubmit} style={{border: '1px solid #ccc', borderRadius: 4, padding: '1rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', maxWidth: 480}}>
            <strong>New Message Implementation Guide</strong>
            <div style={fieldStyle}>
                <label>Name *</label>
                <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} required autoFocus/>
            </div>
            <div style={fieldStyle}>
                <label>Version *</label>
                <input style={inputStyle} value={version} onChange={e => setVersion(e.target.value)} required/>
            </div>
            <div style={fieldStyle}>
                <label>Description</label>
                <textarea style={{...inputStyle, resize: 'vertical'}} rows={3} value={description} onChange={e => setDescription(e.target.value)}/>
            </div>
            <div style={{display: 'flex', gap: '0.5rem'}}>
                <button type="submit">Save</button>
                <button type="button" onClick={onCancel}>Cancel</button>
            </div>
        </form>
    )
}

export function MessageDetail({messageId, versions, businessArea, dataTypes, onMigCreated}: {
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
            <p><a href="#">← Back</a></p>

            <div>
                <div style={{color: '#666', fontSize: '1em'}}>{businessArea.name}</div>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                    <h3 style={{marginTop: '0.2em'}}>{message.name}</h3>
                    <div style={{display: 'flex', gap: '0.5rem'}}>
                        <button onClick={() => exportMessageDefinition(message, dataTypes)}>Export</button>
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
                        {versionLabel(msg.name)}
                    </a>
                ))}
            </div>

            {showMigForm && (
                <MigForm messageIdentifier={message.identifier} onSave={handleMigSave} onCancel={() => setShowMigForm(false)}/>
            )}

            <p style={{whiteSpace: 'pre-wrap'}}>{message.definition}</p>

            <MessageStructure message={message} dataTypes={dataTypes}/>
        </div>
    )
}