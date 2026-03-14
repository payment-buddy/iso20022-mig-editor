import type {Constraint} from "./types.ts";
import {formatXml} from "./formatXml.ts";

export function ConstraintDetail({constraint}: { constraint: Constraint }) {
    return (
        <div>
            <details open={true}>
                <summary>Name</summary>
                <div>{constraint.name}</div>
            </details>
            <details open={true}>
                <summary>Description</summary>
                <div>{constraint.definition}</div>
            </details>
            {constraint.expression && (
                <details open={false}>
                    <summary>Expression</summary>
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