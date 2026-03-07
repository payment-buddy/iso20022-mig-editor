import type {ComplexType, Constraint, DataType, MessageElement} from "./types.ts";
import {ConstraintNode} from "./ConstraintNode.tsx";

function Cardinality({element}: { element: MessageElement }) {
    return (
        <span style={{color: '#888', marginLeft: '0.4em'}}>
            [{element.minOccurs}..{element.maxOccurs}]
        </span>
    )
}

export function ElementNode({element, selectedElement, selectedConstraint, dataTypes, showXmlTags, xmlPath, onSelect, onSelectConstraint}: {
    element: MessageElement
    selectedElement: MessageElement | null
    selectedConstraint: Constraint | null
    dataTypes: Map<string, DataType>
    showXmlTags: boolean
    xmlPath: string[]
    onSelect: (elem: MessageElement, xmlPath: string[]) => void
    onSelectConstraint: (constraint: Constraint) => void
}) {
    const dataType = dataTypes.get(element.typeId) as ComplexType
    const background = element.id === selectedElement?.id ? '#2b5ce6' : 'transparent'
    const elementPath = [...xmlPath, element.xmlTag]

    if (!dataType.elements?.length && !element.constraints?.length) {
        return (
            <div style={{marginLeft: '1em', cursor: 'pointer', background: background}}
                 onClick={() => onSelect(element, elementPath)}>
                {showXmlTags ? element.xmlTag : element.name}
                <Cardinality element={element}/>
            </div>
        )
    }

    return (
        <details style={{marginLeft: '1em', cursor: 'pointer'}}>
            <summary style={{background: background}} onClick={() => onSelect(element, elementPath)}>
                {showXmlTags ? element.xmlTag : element.name}
                <Cardinality element={element}/>
            </summary>
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
        </details>
    )
}