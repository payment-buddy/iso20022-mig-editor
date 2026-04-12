import type {MessageDefinition, MessageImplementationGuide} from "../types/types.ts"
import {useState} from "react"

export function MigCreateForm({message, onSave, onCancel}: {
    message: MessageDefinition
    onSave: (mig: MessageImplementationGuide) => void
    onCancel: () => void
}) {
    const [name, setName] = useState('MIG-' + message.identifier)
    const [version, setVersion] = useState('1.0-DRAFT')

    function handleSubmit(e: { preventDefault(): void }) {
        e.preventDefault()
        const mig: MessageImplementationGuide = {
            id: crypto.randomUUID(),
            name: name.trim(),
            messageIdentifier: message.identifier,
            parentMIG: null,
            version: version.trim(),
            description: '',
            elementOverrides: {},
        }
        onSave(mig)
    }

    const fieldStyle = {display: 'flex', flexDirection: 'column' as const, gap: '0.2rem'}
    const inputStyle = {padding: '0.3em 0.5em', fontSize: '1em', width: '100%', boxSizing: 'border-box' as const}

    return (
        <form onSubmit={handleSubmit} style={{
            border: '1px solid #ccc',
            borderRadius: 4,
            padding: '1rem',
            marginBottom: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.8rem',
            maxWidth: 480
        }}>
            <strong>New Message Implementation Guide</strong>
            <div style={fieldStyle}>
                <label>Name *</label>
                <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} required autoFocus/>
            </div>
            <div style={fieldStyle}>
                <label>Version *</label>
                <input style={inputStyle} value={version} onChange={e => setVersion(e.target.value)} required/>
            </div>
            <div style={{display: 'flex', gap: '0.5rem'}}>
                <button type="submit">Save</button>
                <button type="button" onClick={onCancel}>Cancel</button>
            </div>
        </form>
    )
}