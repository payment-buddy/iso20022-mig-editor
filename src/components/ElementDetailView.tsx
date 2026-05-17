import type {DataType, MessageElement, SimpleType} from "../types/types.ts"

export function ElementDetailView({element, dataType, xmlPath}: {
    element: MessageElement
    dataType: DataType
    xmlPath: string
}) {
    const simpleType = dataType as SimpleType
    const baseType = simpleType.baseType
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
                <div>{element.type} {baseType && <span>({baseType})</span>}</div>
            </div>
            <div>
                <div className="detail-label">Definition</div>
                <div style={{whiteSpace: 'pre-wrap'}}>{element.definition || dataType.definition}</div>
            </div>
            <div>
                <div className="detail-label">Multiplicity</div>
                <div>[{element.minOccurs}..{element.maxOccurs ?? 'unbounded'}]</div>
            </div>
            {element.examples.length > 0 && (
                <div>
                    <div className="detail-label">Examples</div>
                    <div>{element.examples.join(', ')}</div>
                </div>
            )}
        </div>
    )
}