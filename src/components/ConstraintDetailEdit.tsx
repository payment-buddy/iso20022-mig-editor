import type {Constraint} from "../types/types.ts"
import {EditableText} from "./EditableText.tsx"

export function ConstraintDetailEdit({constraint, onUpdate, onDelete, isNew, customConstraintPropertyNames, isInherited}: {
    constraint: Constraint
    onUpdate: (updated: Constraint) => void
    onDelete: () => void
    isNew?: boolean
    customConstraintPropertyNames?: string
    isInherited?: boolean
}) {
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
                <EditableText
                    value={constraint.name}
                    autoFocus={isNew}
                    onSave={val => val && onUpdate({...constraint, name: val})}
                />
            </div>
            <div>
                <div className="detail-label">Definition</div>
                <EditableText
                    value={constraint.definition}
                    multiline
                    onSave={val => onUpdate({...constraint, definition: val})}
                />
            </div>
            {customPropNames.length > 0 && (
                <>
                    {customPropNames.map(name => {
                        const currentValue = constraint.customProperties?.[name] ?? ''
                        return (
                            <div key={name}>
                                <div className="detail-label">{name}</div>
                                {isInherited
                                    ? <div>{currentValue}</div>
                                    : <EditableText
                                        value={currentValue}
                                        onSave={val => saveCustomProperty(name, val)}
                                    />
                                }
                            </div>
                        )
                    })}
                </>
            )}
            <div>
                <button onClick={onDelete}>Delete</button>
            </div>
        </div>
    )
}
