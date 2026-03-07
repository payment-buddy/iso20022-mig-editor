import type {DataType, MessageElement} from "./types.ts";

export function ElementDetail({element, dataType}: {
    element: MessageElement,
    dataType: DataType
}) {
    return (
        <div>
            <details open={true}>
                <summary>Type</summary>
                <div>{dataType.name}</div>
            </details>
            <details open={true}>
                <summary>Description</summary>
                <div>{element.definition}</div>
            </details>
            <details open={true}>
                <summary>Multiplicity</summary>
                <div>[{element.minOccurs}..{element.maxOccurs}]</div>
            </details>
            <details open={true}>
                <summary>XML Tag</summary>
                <div>{element.xmlTag}</div>
            </details>
        </div>
    )
}