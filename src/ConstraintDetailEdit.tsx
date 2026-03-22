import type {Constraint} from "./types.ts";
import {EditableText} from "./EditableText.tsx";

export function ConstraintDetailEdit({constraint, onUpdate, onDelete}: {
    constraint: Constraint
    onUpdate: (updated: Constraint) => void
    onDelete: () => void
}) {
    return (
        <div className="detail-panel">
            <div>
                <div className="detail-label">Name</div>
                <EditableText
                    value={constraint.name}
                    isOverridden={false}
                    onSave={val => val && onUpdate({...constraint, name: val})}
                />
            </div>
            <div>
                <div className="detail-label">Definition</div>
                <EditableText
                    value={constraint.definition}
                    isOverridden={false}
                    multiline
                    onSave={val => onUpdate({...constraint, definition: val})}
                />
            </div>
            <div>
                <div className="detail-label">Expression</div>
                <EditableText
                    value={constraint.expression}
                    isOverridden={false}
                    multiline
                    monospace
                    onSave={val => onUpdate({...constraint, expression: val})}
                />
            </div>
            <div>
                <button onClick={onDelete}>Delete</button>
            </div>
        </div>
    )
}
