import type {Constraint} from "./types.ts";

function formatXml(xml: string): string {
    try {
        const doc = new DOMParser().parseFromString(xml, 'text/xml')
        if (doc.querySelector('parsererror')) return xml
        return serializeNode(doc.documentElement, 0) ?? xml
    } catch {
        return xml
    }
}

function serializeNode(node: Node, depth: number): string | null {
    const indent = '  '.repeat(depth)
    if (node.nodeType === 3) {
        const text = node.textContent?.trim() ?? ''
        return text ? indent + text : null
    }
    const el = node as Element
    const attrs = Array.from(el.attributes).map(a => ` ${a.name}="${a.value}"`).join('')
    const children = Array.from(el.childNodes)
        .map(c => serializeNode(c, depth + 1))
        .filter((s): s is string => s !== null)
    if (children.length === 0) return `${indent}<${el.tagName}${attrs}/>`
    if (children.length === 1 && !children[0].includes('\n')) {
        return `${indent}<${el.tagName}${attrs}>${children[0].trim()}</${el.tagName}>`
    }
    return `${indent}<${el.tagName}${attrs}>\n${children.join('\n')}\n${indent}</${el.tagName}>`
}

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
                <details open={true}>
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