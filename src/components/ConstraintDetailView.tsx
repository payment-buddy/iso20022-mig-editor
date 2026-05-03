import type {Constraint} from "../types/types.ts"

export function ConstraintDetailView({constraint, customConstraintPropertyNames}: {
    constraint: Constraint,
    customConstraintPropertyNames?: string
}) {
    const customPropNames = (customConstraintPropertyNames ?? '')
        .split(',')
        .map(n => n.trim())
        .filter(n => n.length > 0)

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
                        <div className="detail-label">{name}</div>
                        <div>{value}</div>
                    </div>
                )
            })}
        </div>
    )
}