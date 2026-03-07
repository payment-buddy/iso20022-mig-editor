import type {Constraint, DataType, MessageDefinition, MessageElement} from "./types.ts";
import {ElementNode} from "./ElementNode.tsx";
import {useState} from "react";
import {ElementDetail} from "./ElementDetail.tsx";
import {ConstraintNode} from "./ConstraintNode.tsx";

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

function ContraintDetail({constraint}: { constraint: Constraint }) {
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

export function MessageStructure({message, dataTypes}: {
    message: MessageDefinition
    dataTypes: Map<string, DataType>
}) {
    const [showXmlTags, setShowXmlTags] = useState(false)
    const [selectedElement, setSelectedElement] = useState<MessageElement | null>(null)
    const [selectedXmlPath, setSelectedXmlPath] = useState<string[]>([])
    const [selectedDataType, setSelectedDataType] = useState<DataType | null>(null)
    const [selectedConstraint, setSelectedConstraint] = useState<Constraint | null>(null)

    function handleSelectElement(element: MessageElement, xmlPath: string[]) {
        setSelectedElement(element)
        setSelectedXmlPath(xmlPath)
        setSelectedDataType(dataTypes.get(element.typeId) ?? null)
        setSelectedConstraint(null)
    }

    function handleSelectContraint(constraint: Constraint) {
        setSelectedConstraint(constraint)
        setSelectedDataType(null)
        setSelectedElement(null)
    }

    return (
        <>
            <div>
                <input type="checkbox" checked={showXmlTags} onChange={() => setShowXmlTags(show => !show)}/>
                Show XML tags
            </div>
            <div style={{display: 'flex', gap: '1em'}}>
                <div style={{flex: 3}}>
                    <div>{showXmlTags ? message.xmlTag : message.name}</div>
                    {message.elements.map((block) => (
                        <ElementNode key={block.id}
                                     element={block}
                                     selectedElement={selectedElement}
                                     selectedConstraint={selectedConstraint}
                                     dataTypes={dataTypes}
                                     showXmlTags={showXmlTags}
                                     xmlPath={[message.xmlTag]}
                                     onSelect={handleSelectElement}
                                     onSelectConstraint={handleSelectContraint}/>
                    ))}
                    {message.constraints.map((constraint) => (
                        <ConstraintNode key={constraint.name}
                                        constraint={constraint}
                                        selectedConstraint={selectedConstraint}
                                        onSelect={handleSelectContraint}/>
                    ))}
                </div>
                <div style={{flex: 4}}>
                    {selectedElement &&
                        <ElementDetail element={selectedElement}
                                       dataType={selectedDataType!}
                                       xmlPath={selectedXmlPath}/>}
                    {selectedConstraint &&
                        <ContraintDetail constraint={selectedConstraint}/>}
                </div>
            </div>
        </>
    )
}