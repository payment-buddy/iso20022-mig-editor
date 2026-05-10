import type {Constraint} from "../types/types.ts"
import {splitCamelCase} from "../utils/stringUtils.ts"

export function ConstraintDetailView({constraint, customConstraintPropertyNames}: {
    constraint: Constraint,
    customConstraintPropertyNames?: string[]
}) {
    const customPropNames = customConstraintPropertyNames ?? []

    return (
        <div className="detail-panel">
            <div>
                <div className="detail-label">Name</div>
                <div>{constraint.name}</div>
            </div>
            <div>
                <div className="detail-label">Description</div>
                <div>{constraint.definition}</div>
            </div>
            {customPropNames.map(name => {
                const value = constraint.customProperties?.[name]
                if (!value) return null
                return (
                    <div key={name}>
                        <div className="detail-label">{splitCamelCase(name)}</div>
                        <div>{value}</div>
                    </div>
                )
            })}
        </div>
    )
}