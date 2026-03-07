import type {ComplexType, DataType, MessageElement} from "./types.ts";

function cardinality(minOccurs: string, maxOccurs: string) {
    const max = maxOccurs === 'unbounded' ? 'n' : maxOccurs
    return `${minOccurs}..${max}`
}

export function ElementNode({element, dataTypes}: {
    element: MessageElement
    dataTypes: Map<string, DataType>
}) {
    const dataType = dataTypes.get(element.typeId) as ComplexType
    return (
        <li>
            <span>{element.name}</span>
            <span style={{color: '#888', marginLeft: '0.4em'}}>
                        [{cardinality(element.minOccurs, element.maxOccurs)}]
                    </span>
            {dataType.elements && (
                <ul style={{listStyle: 'none'}}>
                    {dataType.elements.map(child => (
                        <ElementNode key={child.id} element={child} dataTypes={dataTypes}/>
                    ))}
                </ul>
            )}
        </li>
    )
}