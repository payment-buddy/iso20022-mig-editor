import type {ComplexType, DataType, MessageElement} from "./types.ts";

function Cardinality({element}: { element: MessageElement }) {
    return (
        <span style={{color: '#888', marginLeft: '0.4em'}}>
            [{element.minOccurs}..{element.maxOccurs}]
        </span>
    )
}

export function ElementNode({element, selectedElement, dataTypes, showXmlTags, onSelect}: {
    element: MessageElement
    selectedElement: MessageElement | null
    dataTypes: Map<string, DataType>
    showXmlTags: boolean
    onSelect: (elem: MessageElement) => void
}) {
    const dataType = dataTypes.get(element.typeId) as ComplexType
    const background = element.id === selectedElement?.id ? '#2b5ce6' : 'transparent'

    if (!dataType.elements?.length) {
        return (
            <div style={{marginLeft: '1em', cursor: 'pointer', background: background}} onClick={() => onSelect(element)}>
                {showXmlTags ? element.xmlTag : element.name}
                <Cardinality element={element}/>
            </div>
        )
    }

    return (
        <details style={{marginLeft: '1em', cursor: 'pointer'}}>
            <summary style={{background: background}} onClick={() => onSelect(element)}>
                {showXmlTags ? element.xmlTag : element.name}
                <Cardinality element={element}/>
            </summary>
            {dataType.elements?.map(child => (
                <ElementNode key={child.id} element={child} selectedElement={selectedElement} dataTypes={dataTypes}
                             showXmlTags={showXmlTags} onSelect={onSelect}/>
            ))}
        </details>
    )
}