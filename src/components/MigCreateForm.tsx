import type {MessageDefinition, MessageImplementationGuide} from "../types/types.ts"
import {useState} from "react"
import {Modal} from "./Modal.tsx"

export function MigCreateForm({message, onCreateMig, onCancel}: {
    message: MessageDefinition
    onCreateMig: (mig: MessageImplementationGuide) => void
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
        onCreateMig(mig)
    }

    const fieldStyle = {display: 'flex', flexDirection: 'column' as const, gap: '0.2rem'}
    const inputStyle = {padding: '0.3em 0.5em', fontSize: '1em', width: '100%', boxSizing: 'border-box' as const}

    return (
        <Modal
            onClose={onCancel}
            title="New Message Implementation Guide"
            footer={
                <>
                    <button type="button" onClick={onCancel}>Cancel</button>
                    <button type="submit" form="mig-create-form">Save</button>
                </>
            }
        >
            <form id="mig-create-form" onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '0.8rem'}}>
                <div style={fieldStyle}>
                    <label>Name *</label>
                    <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} required autoFocus/>
                </div>
                <div style={fieldStyle}>
                    <label>Version *</label>
                    <input style={inputStyle} value={version} onChange={e => setVersion(e.target.value)} required/>
                </div>
            </form>
        </Modal>
    )
}