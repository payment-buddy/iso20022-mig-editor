import type {DataType, MessageElement, SimpleType} from "../types/types.ts"

export function ElementDetailView({element, dataType, xmlPath}: {
    element: MessageElement
    dataType: DataType
    xmlPath: string
}) {
    const typeExamples = (dataType as SimpleType).examples ?? []
    const examples = element.examples?.length > 0 ? element.examples : typeExamples

    return (
        <div className="detail-panel">
            <div>
                <div className="detail-label">{element.isAttribute ? 'XML Attribute' : 'XML Tag'}</div>
                <div style={{fontFamily: 'monospace'}}>{element.xmlTag}</div>
            </div>
            <div>
                <div className="detail-label">XML Path</div>
                <div style={{fontFamily: 'monospace'}}>{xmlPath}</div>
            </div>
            <div>
                <div className="detail-label">Type</div>
                <div>{dataType.name}</div>
            </div>
            <div>
                <div className="detail-label">Definition</div>
                <div style={{whiteSpace: 'pre-wrap'}}>{element.definition || dataType.definition}</div>
            </div>
            <div>
                <div className="detail-label">Multiplicity</div>
                <div>[{element.minOccurs}..{element.maxOccurs ?? 'unbounded'}]</div>
            </div>
            {examples.length > 0 && (
                <div>
                    <div className="detail-label">Examples</div>
                    <div>{examples.join(', ')}</div>
                </div>
            )}
        </div>
    )
}