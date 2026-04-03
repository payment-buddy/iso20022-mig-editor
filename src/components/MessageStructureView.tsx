import type {Constraint, DataType, DataTypes, MessageDefinition, MessageElement} from "../types/types.ts"
import {useState} from "react"
import {ElementDetailView} from "./ElementDetailView.tsx"
import {ConstraintDetailView} from "./ConstraintDetailView.tsx"
import {DetailPanel} from "./DetailPanel.tsx"
import {MessageTreeView} from "./MessageTreeView.tsx"

export function MessageStructureView({message, dataTypes}: {
    message: MessageDefinition
    dataTypes: DataTypes
}) {
    const [showXmlTags, setShowXmlTags] = useState(false)
    const [selectedElement, setSelectedElement] = useState<MessageElement | null>(null)
    const [selectedXmlPath, setSelectedXmlPath] = useState<string>('')
    const [selectedDataType, setSelectedDataType] = useState<DataType | null>(null)
    const [selectedConstraint, setSelectedConstraint] = useState<Constraint | null>(null)

    function handleSelectElement(element: MessageElement, xmlPath: string) {
        setSelectedElement(element)
        setSelectedXmlPath(xmlPath)
        setSelectedDataType(dataTypes[element.typeId] ?? null)
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
                <MessageTreeView
                    message={message}
                    dataTypes={dataTypes}
                    showXmlTags={showXmlTags}
                    selectedPath={selectedXmlPath}
                    onSelectElement={handleSelectElement}
                    onSelectConstraint={handleSelectContraint}
                />
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