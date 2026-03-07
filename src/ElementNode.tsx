import type {ComplexType, DataType, MessageElement} from "./types.ts";

function Cardinality({element}: { element: MessageElement }) {
    const max = element.maxOccurs === 'unbounded' ? 'n' : element.maxOccurs
    return (
        <span style={{color: '#888', marginLeft: '0.4em'}}>
            [{element.minOccurs}..{max}]
        </span>
    )
}

export function ElementNode({element, dataTypes, showXmlTags}: {
    element: MessageElement
    dataTypes: Map<string, DataType>
    showXmlTags: boolean
}) {
    const dataType = dataTypes.get(element.typeId) as ComplexType

    if (!dataType.elements?.length) {
        return (
            <div style={{marginLeft: '1em'}}>
                {showXmlTags ? element.xmlTag : element.name}
                <Cardinality element={element}/>
            </div>
        )
    }

    return (
        <details style={{marginLeft: '1em'}}>
            <summary>
                {showXmlTags ? element.xmlTag : element.name}
                <Cardinality element={element}/>
            </summary>
            {dataType.elements?.map(child => (
                <ElementNode key={child.id} element={child} dataTypes={dataTypes} showXmlTags={showXmlTags}/>
            ))}
        </details>
    )
}