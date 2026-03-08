import {useState} from "react";
import type {ComplexType, Constraint, DataType, ElementOverride, MessageElement} from "./types.ts";
import {ConstraintNode} from "./ConstraintNode.tsx";

function Cardinality({element, override}: { element: MessageElement, override: ElementOverride | undefined }) {
    const min = override?.minOccurs ?? element.minOccurs
    const max = override?.maxOccurs ?? element.maxOccurs
    return (
        <span style={{color: '#888', marginLeft: '0.4em'}}>
            [{min}..{max}]
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
                                selectedXmlPath,
                                elementOverrides = [],
                                showExcluded = true,
                                onSelect,
                                onSelectConstraint
                            }: {
    element: MessageElement
    selectedElement: MessageElement | null
    selectedConstraint: Constraint | null
    dataTypes: Map<string, DataType>
    showXmlTags: boolean
    xmlPath: string
    selectedXmlPath: string
    elementOverrides?: ElementOverride[]
    showExcluded?: boolean
    onSelect: (elem: MessageElement, xmlPath: string) => void
    onSelectConstraint: (constraint: Constraint) => void
}) {
    const [open, setOpen] = useState(false)
    const elementPath = xmlPath + '/' + element.xmlTag
    const isSelected = elementPath === selectedXmlPath;
    const background = isSelected ? '#2b5ce6' : 'transparent'
    const color = isSelected ? '#fff' : undefined
    const dataType = dataTypes.get(element.typeId) as ComplexType
    const hasChildren = dataType.elements?.length || element.constraints?.length
    const override = elementOverrides.find(o => o.xmlPath === elementPath)
    const isExcluded = (override?.maxOccurs ?? element.maxOccurs) === 0
    const nameStyle = isExcluded ? {textDecoration: 'line-through' as const} : undefined

    if (isExcluded && !showExcluded) return null

    if (!hasChildren) {
        return (
            <div style={{marginLeft: '1em', cursor: 'pointer', background, color}}
                 onClick={() => onSelect(element, elementPath)}>
                <span style={nameStyle}>{showXmlTags ? element.xmlTag : element.name}</span>
                <Cardinality element={element} override={override}/>
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
                <Cardinality element={element} override={override}/>
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
                                 selectedXmlPath={selectedXmlPath}
                                 elementOverrides={elementOverrides}
                                 showExcluded={showExcluded}
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
