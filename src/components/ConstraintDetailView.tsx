import type {Constraint} from "../types/types.ts"
import {formatXml} from "../utils/formatXml.ts"

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
            {constraint.expression && (
                <details open={false}>
                    <summary className="detail-label">Expression</summary>
                    <pre style={{
                        overflowX: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                    }}>{formatXml(constraint.expression)}</pre>
                </details>
            )}
            {customPropNames.length > 0 && (
                <>
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
                </>
            )}
        </div>
    )
}