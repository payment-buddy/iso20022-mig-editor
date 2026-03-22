import type {Constraint, DataType, MessageDefinition, MessageElement} from "./types.ts";
import {ElementNode} from "./ElementNode.tsx";
import {useState} from "react";
import {ElementDetailView} from "./ElementDetailView.tsx";
import {ConstraintNode} from "./ConstraintNode.tsx";
import {ConstraintDetailView} from "./ConstraintDetailView.tsx";
import {DetailPanel} from "./DetailPanel.tsx";

export function MessageStructure({message, dataTypes}: {
    message: MessageDefinition
    dataTypes: Map<string, DataType>
}) {
    const [showXmlTags, setShowXmlTags] = useState(false)
    const [selectedElement, setSelectedElement] = useState<MessageElement | null>(null)
    const [selectedXmlPath, setSelectedXmlPath] = useState<string>('')
    const [selectedDataType, setSelectedDataType] = useState<DataType | null>(null)
    const [selectedConstraint, setSelectedConstraint] = useState<Constraint | null>(null)

    function handleSelectElement(element: MessageElement, xmlPath: string) {
        setSelectedElement(element)
        setSelectedXmlPath(xmlPath)
        setSelectedDataType(dataTypes.get(element.typeId) ?? null)
        setSelectedConstraint(null)
    }

    function handleSelectContraint(constraint: Constraint, path: string) {
        setSelectedConstraint(constraint)
        setSelectedXmlPath(path)
        setSelectedDataType(null)
        setSelectedElement(null)
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
                        <ElementNode key={block.xmlTag}
                                     element={block}
                                     dataTypes={dataTypes}
                                     showXmlTags={showXmlTags}
                                     parentPath={'/' + message.xmlTag}
                                     selectedPath={selectedXmlPath}
                                     onSelectElement={handleSelectElement}
                                     onSelectConstraint={handleSelectContraint}/>
                    ))}
                    {message.constraints.map((constraint) => (
                        <ConstraintNode key={constraint.name}
                                        constraint={constraint}
                                        parentPath={'/' + message.xmlTag}
                                        selectedPath={selectedXmlPath}
                                        onSelect={handleSelectContraint}/>
                    ))}
                </div>
                <DetailPanel>
                    {selectedElement &&
                        <ElementDetailView element={selectedElement}
                                           dataType={selectedDataType!}
                                           xmlPath={selectedXmlPath}/>}
                    {selectedConstraint &&
                        <ConstraintDetailView constraint={selectedConstraint}/>}
                </DetailPanel>
            </div>
        </>
    )
}