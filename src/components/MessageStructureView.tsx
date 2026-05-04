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
    const [filter, setFilter] = useState('')
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

    function handleSelectConstraint(constraint: Constraint, path: string) {
        setSelectedConstraint(constraint)
        setSelectedXmlPath(path)
        setSelectedDataType(null)
        setSelectedElement(null)
    }

    return (
        <>
            <p style={{display: 'flex', gap: '1em', alignItems: 'center'}}>
                <label>
                    Filter:
                    <input
                        type="text"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        style={{marginLeft: '0.5em'}}
                    />
                </label>
                <label>
                    <input type="checkbox"
                           checked={showXmlTags}
                           style={{marginRight: '0.5em'}}
                           onChange={() => setShowXmlTags(show => !show)}/>
                    Show XML tags
                </label>
            </p>
            <div style={{display: 'flex', gap: '1em'}}>
                <MessageTreeView
                    message={message}
                    dataTypes={dataTypes}
                    showXmlTags={showXmlTags}
                    filter={filter}
                    selectedPath={selectedXmlPath}
                    onSelectElement={handleSelectElement}
                    onSelectConstraint={handleSelectConstraint}
                />
                <DetailPanel>
                    {selectedElement &&
                        <ElementDetailView element={selectedElement}
                                           dataType={selectedDataType!}
                                           xmlPath={selectedXmlPath}/>}
                    {selectedConstraint &&
                        <ConstraintDetailView constraint={selectedConstraint} customConstraintPropertyNames=""/>}
                </DetailPanel>
            </div>
        </>
    )
}