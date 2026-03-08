import {useState} from "react";
import type {ComplexType, Constraint, DataType, MessageElement} from "./types.ts";
import {ConstraintNode} from "./ConstraintNode.tsx";

function Cardinality({element}: { element: MessageElement }) {
    return (
        <span style={{color: '#888', marginLeft: '0.4em'}}>
            [{element.minOccurs}..{element.maxOccurs}]
        </span>
    )
}

export function ElementNode({
                                element,
                                selectedElement,
                                selectedConstraint,
                                dataTypes,
                                showXmlTags,
                                xmlPath,
                                onSelect,
                                onSelectConstraint
                            }: {
    element: MessageElement
    selectedElement: MessageElement | null
    selectedConstraint: Constraint | null
    dataTypes: Map<string, DataType>
    showXmlTags: boolean
    xmlPath: string
    onSelect: (elem: MessageElement, xmlPath: string) => void
    onSelectConstraint: (constraint: Constraint) => void
}) {
    const [open, setOpen] = useState(false)
    const dataType = dataTypes.get(element.typeId) as ComplexType
    const background = element.id === selectedElement?.id ? '#2b5ce6' : 'transparent'
    const elementPath = xmlPath + '/' + element.xmlTag
    const hasChildren = dataType.elements?.length || element.constraints?.length

    if (!hasChildren) {
        return (
            <div style={{marginLeft: '1em', cursor: 'pointer', background: background}}
                 onClick={() => onSelect(element, elementPath)}>
                {showXmlTags ? element.xmlTag : element.name}
                <Cardinality element={element}/>
            </div>
        )
    }

    return (
        <div style={{marginLeft: '1em'}}>
            <div style={{cursor: 'pointer', background: background}} onClick={() => {
                onSelect(element, elementPath)
                setOpen(o => !o)
            }}>
                <span style={{marginRight: '0.3em', fontSize: '0.7em'}}>{open ? '▼' : '▶'}</span>
                {showXmlTags ? element.xmlTag : element.name}
                <Cardinality element={element}/>
            </div>
            {open && <>
                {dataType.elements?.map(child => (
                    <ElementNode key={child.id}
                                 element={child}
                                 selectedElement={selectedElement}
                                 selectedConstraint={selectedConstraint}
                                 dataTypes={dataTypes}
                                 showXmlTags={showXmlTags}
                                 xmlPath={elementPath}
                                 onSelect={onSelect}
                                 onSelectConstraint={onSelectConstraint}/>
                ))}
                {element.constraints.map((constraint) => (
                    <ConstraintNode key={constraint.name}
                                    constraint={constraint}
                                    selectedConstraint={selectedConstraint}
                                    onSelect={onSelectConstraint}/>
                ))}
            </>}
        </div>
    )
}
