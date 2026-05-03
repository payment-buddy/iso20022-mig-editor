import type {BusinessArea, DataTypes, MessageDefinition, MessageImplementationGuide} from "../types/types.ts"
import {MessageStructureView} from "../components/MessageStructureView.tsx"
import {useState} from "react"
import {MessageVersionSelector} from "../components/MessageVersionSelector.tsx"
import {MigCreateForm} from "../components/MigCreateForm.tsx"


export function MessageDetailPage({messageId, versions, businessArea, dataTypes, onMigCreated}: {
    messageId: string | null
    versions: MessageDefinition[]
    businessArea: BusinessArea
    dataTypes: DataTypes
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
            <a href="#browse" className="back-link">← Back</a>

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

            <MessageVersionSelector versions={versions} currentMessage={message}/>

            {showMigForm && (
                <MigCreateForm message={message} onSave={handleMigSave} onCancel={() => setShowMigForm(false)}/>
            )}

            <p style={{whiteSpace: 'pre-wrap'}}>{message.rootElement.definition}</p>

            <MessageStructureView message={message} dataTypes={dataTypes}/>
        </div>
    )
}