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
    return (
        <>
            <div>
                <input type="checkbox" checked={showXmlTags} onChange={() => setShowXmlTags(show => !show)}/>
                Show XML tags
            </div>
            <div style={{display: 'flex', gap: '1em'}}>
                <div style={{flex: 3}}>
                    <div>{showXmlTags ? message.xmlTag : message.name}</div>
                    {message.blocks.map((block) => (
                        <ElementNode key={block.id} element={block} selectedElement={selectedElement}
                                     dataTypes={dataTypes} showXmlTags={showXmlTags}
                                     onSelect={(elem) => setSelectedElement(elem)}/>
                    ))}
                </div>
                <div style={{flex: 4}}>
                    {selectedElement && <ElementDetail element={selectedElement}/>}
                </div>
            </div>
        </>
    )
}