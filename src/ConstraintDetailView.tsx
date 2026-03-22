import type {Constraint} from "./types.ts";
import {formatXml} from "./formatXml.ts";

export function ConstraintDetailView({constraint}: { constraint: Constraint }) {
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
        </div>
    )
}