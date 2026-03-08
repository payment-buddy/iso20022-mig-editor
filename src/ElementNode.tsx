import {useState} from "react";
import type {ComplexType, Constraint, DataType, ElementOverride, MessageElement} from "./types.ts";
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
                                elementOverrides = [],
                                onSelect,
                                onSelectConstraint
                            }: {
    element: MessageElement
    selectedElement: MessageElement | null
    selectedConstraint: Constraint | null
    dataTypes: Map<string, DataType>
    showXmlTags: boolean
    xmlPath: string
    elementOverrides?: ElementOverride[]
    onSelect: (elem: MessageElement, xmlPath: string) => void
    onSelectConstraint: (constraint: Constraint) => void
}) {
    const [open, setOpen] = useState(false)
    const dataType = dataTypes.get(element.typeId) as ComplexType
    const background = element.id === selectedElement?.id ? '#2b5ce6' : 'transparent'
    const color = element.id === selectedElement?.id ? '#fff' : undefined
    const elementPath = xmlPath + '/' + element.xmlTag
    const hasChildren = dataType.elements?.length || element.constraints?.length
    const isExcluded = elementOverrides.some(o => o.xmlPath === elementPath && o.maxOccurs === 0)
    const nameStyle = isExcluded ? {textDecoration: 'line-through' as const} : undefined

    if (!hasChildren) {
        return (
            <div style={{marginLeft: '1em', cursor: 'pointer', background, color}}
                 onClick={() => onSelect(element, elementPath)}>
                <span style={nameStyle}>{showXmlTags ? element.xmlTag : element.name}</span>
                <Cardinality element={element}/>
            </div>
        )
    }

    return (
        <div style={{marginLeft: '1em'}}>
            <div style={{cursor: 'pointer', background, color}} onClick={() => {
                onSelect(element, elementPath)
                setOpen(o => !o)
            }}>
                <span style={{marginRight: '0.3em', fontSize: '0.7em'}}>{open ? '▼' : '▶'}</span>
                <span style={nameStyle}>{showXmlTags ? element.xmlTag : element.name}</span>
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
                                 elementOverrides={elementOverrides}
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
