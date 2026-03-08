import type {DataType, ElementOverride, MessageElement} from "./types.ts";

export function ElementDetailEdit({element, dataType, xmlPath, elementOverride}: {
    element: MessageElement
    dataType: DataType
    xmlPath: string
    elementOverride: ElementOverride | null
}) {
    return (
        <div>
            <div>
                <div>XML Tag</div>
                <div>{element.xmlTag}</div>
            </div>
            <div>
                <div>XML Path</div>
                <div>{xmlPath}</div>
            </div>
            <div>
                <div>Type</div>
                <div>{dataType.name}</div>
            </div>
            <div>
                <div>Definition</div>
                <div>{elementOverride?.definition ?? element.definition}</div>
            </div>
            <div>
                <div>Min Occurs</div>
                <div>{elementOverride?.minOccurs ?? element.minOccurs}</div>
            </div>
            <div>
                <div>Max Occurs</div>
                <div>{elementOverride?.maxOccurs ?? element.maxOccurs}</div>
            </div>
            <div>
                {JSON.stringify(elementOverride)}
            </div>
        </div>
    )
}