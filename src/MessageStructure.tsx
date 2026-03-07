import type {DataType, MessageDefinition, MessageElement} from "./types.ts";
import {ElementNode} from "./ElementNode.tsx";
import {useState} from "react";
import {ElementDetail} from "./ElementDetail.tsx";

export function MessageStructure({message, dataTypes}: {
    message: MessageDefinition
    dataTypes: Map<string, DataType>
}) {
    const [showXmlTags, setShowXmlTags] = useState(false)
    const [selectedElement, setSelectedElement] = useState<MessageElement | null>(null)
    const [selectedXmlPath, setSelectedXmlPath] = useState<string[]>([])
    const [selectedDataType, setSelectedDataType] = useState<DataType | null>(null)

    function handleSelect(element: MessageElement, xmlPath: string[]) {
        setSelectedElement(element)
        setSelectedXmlPath(xmlPath)
        setSelectedDataType(dataTypes.get(element.typeId) ?? null)
    }

    return (
        <>
            <div>
                <input type="checkbox" checked={showXmlTags} onChange={() => setShowXmlTags(show => !show)}/>
                Show XML tags
            </div>
            <div style={{display: 'flex', gap: '1em'}}>
                <div style={{flex: 3}}>
                    <div>{showXmlTags ? message.xmlTag : message.name}</div>
                    {message.elements.map((block) => (
                        <ElementNode key={block.id}
                                     element={block}
                                     selectedElement={selectedElement}
                                     dataTypes={dataTypes}
                                     showXmlTags={showXmlTags}
                                     xmlPath={[message.xmlTag]}
                                     onSelect={handleSelect}/>
                    ))}
                </div>
                <div style={{flex: 4}}>
                    {selectedElement &&
                        <ElementDetail element={selectedElement} dataType={selectedDataType!}
                                       xmlPath={selectedXmlPath}/>}
                </div>
            </div>
        </>
    )
}