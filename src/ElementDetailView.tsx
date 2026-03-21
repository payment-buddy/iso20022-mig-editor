import type {DataType, MessageElement} from "./types.ts";

export function ElementDetailView({element, dataType, xmlPath}: {
    element: MessageElement
    dataType: DataType
    xmlPath: string
}) {
    return (
        <div className="detail-panel">
            <div>
                <div className="detail-label">Type</div>
                <div>{dataType.name}</div>
            </div>
            <div>
                <div className="detail-label">Definition</div>
                <div>{element.definition}</div>
            </div>
            <div>
                <div className="detail-label">Multiplicity</div>
                <div>[{element.minOccurs}..{element.maxOccurs}]</div>
            </div>
            <div>
                <div className="detail-label">XML Tag</div>
                <div>{element.xmlTag}</div>
            </div>
            <div>
                <div className="detail-label">XML Path</div>
                <div>{xmlPath}</div>
            </div>
        </div>
    )
}