import {useState} from "react"
import type {Constraint} from "../types/types.ts"
import {splitCamelCase} from "../utils/stringUtils.ts"
import {EditableField} from "./EditableField.tsx"
import {Modal} from "./Modal.tsx"

export function ConstraintDetailEdit({
                                         constraint,
                                         onUpdate,
                                         onDelete,
                                         customConstraintPropertyNames,
                                         isInherited
                                     }: {
    constraint: Constraint
    onUpdate: (updated: Constraint) => void
    onDelete: () => void
    customConstraintPropertyNames?: string
    isInherited?: boolean
}) {
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const customPropNames = (customConstraintPropertyNames ?? '')
        .split(',')
        .map(n => n.trim())
        .filter(n => n.length > 0)

    function saveCustomProperty(name: string, val: string) {
        const newProps = {...(constraint.customProperties ?? {})}
        if (!val.trim()) {
            delete newProps[name]
        } else {
            newProps[name] = val.trim()
        }
        const customProperties = Object.keys(newProps).length > 0 ? newProps : undefined
        onUpdate({...constraint, customProperties})
    }

    return (
        <div className="detail-panel">
            <div>
                <div className="detail-label">Name</div>
                <EditableField
                    value={constraint.name}
                    originalValue={constraint.name}
                    onSave={val => val && onUpdate({...constraint, name: val})}
                />
            </div>
            <div>
                <div className="detail-label">Definition</div>
                <EditableField
                    value={constraint.definition}
                    originalValue={constraint.definition}
                    inputType="textarea"
                    onSave={val => onUpdate({...constraint, definition: val})}
                />
            </div>
            {customPropNames.map(name => {
                const currentValue = constraint.customProperties?.[name]
                return (
                    <div key={name}>
                        <div className="detail-label">{splitCamelCase(name)}</div>
                        {isInherited
                            ? <div>{currentValue}</div>
                            : <EditableField
                                value={currentValue}
                                originalValue={currentValue}
                                onSave={val => saveCustomProperty(name, val)}
                            />
                        }
                    </div>
                )
            })}
            <div>
                <button onClick={() => setShowDeleteModal(true)}>Delete</button>
            </div>
            {showDeleteModal && (
                <Modal
                    onClose={() => setShowDeleteModal(false)}
                    footer={
                        <>
                            <button type="button" onClick={() => { onDelete(); setShowDeleteModal(false) }}>Delete</button>
                            <button type="button" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                        </>
                    }
                >
                    <p>Delete constraint <code>{constraint.name}</code>?</p>
                </Modal>
            )}
        </div>
    )
}
