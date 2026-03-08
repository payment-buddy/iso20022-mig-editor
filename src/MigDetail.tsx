import {stringify} from "yaml";
import type {Constraint, DataType, ERepository, MessageElement, MessageImplementationGuideline} from "./types.ts";
import {ElementNode} from "./ElementNode.tsx";
import {ConstraintNode} from "./ConstraintNode.tsx";
import {useState} from "react";
import {ElementDetailEdit} from "./ElementDetailEdit.tsx";

export function MigDetail({mig, eRepository}: { mig: MessageImplementationGuideline, eRepository: ERepository }) {
    const [showXmlTags, setShowXmlTags] = useState(false)
    const [selectedElement, setSelectedElement] = useState<MessageElement | null>(null)
    const [selectedConstraint, setSelectedConstraint] = useState<Constraint | null>(null)
    const [selectedXmlPath, setSelectedXmlPath] = useState<string[]>([])
    const [selectedDataType, setSelectedDataType] = useState<DataType | null>(null)


    let message = null
    for (const ba of eRepository.businessAreas) {
        const found = ba.messages.find(m => m.identifier === mig.messageIdentifier)
        if (found) {
            message = found;
            break
        }
    }

    function handleDownload() {
        const blob = new Blob([stringify(mig)], {type: 'text/yaml'})
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${mig.messageIdentifier}-${mig.name}-${mig.version}.yaml`
        a.click()
    }

    function handleSelectElement(element: MessageElement, xmlPath: string[]) {
        setSelectedElement(element)
        setSelectedConstraint(null)
        setSelectedXmlPath(xmlPath)
        setSelectedDataType(eRepository.dataTypes.get(element.typeId) ?? null)
    }

    function handleSelectContraint(constraint: Constraint) {
        setSelectedElement(null)
        setSelectedConstraint(constraint)
        setSelectedDataType(null)
    }

    return (
        <div>
            <p><a href="#">← Back</a></p>

            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                <h2 style={{margin: 0}}>{mig.name}</h2>
                <button onClick={handleDownload}>Download</button>
            </div>
            <div>
                {mig.messageIdentifier}
            </div>
            <div>
                {mig.version}
            </div>

            {mig.description && (
                <p style={{whiteSpace: 'pre-wrap'}}>{mig.description}</p>
            )}

            <div>
                <input type="checkbox" checked={showXmlTags} onChange={() => setShowXmlTags(show => !show)}/>
                Show XML tags
            </div>

            <p>{selectedXmlPath.join("/")}</p>

            {message && (
                <div style={{display: 'flex', gap: '1em'}}>
                    <div style={{flex: 3}}>
                        <div>{message.xmlTag}</div>
                        {message.elements.map(element => (
                            <ElementNode key={element.id}
                                         element={element}
                                         selectedElement={selectedElement}
                                         selectedConstraint={selectedConstraint}
                                         dataTypes={eRepository.dataTypes}
                                         showXmlTags={showXmlTags}
                                         xmlPath={[message.xmlTag]}
                                         onSelect={handleSelectElement}
                                         onSelectConstraint={handleSelectContraint}/>
                        ))}
                        {message.constraints.map(c => (
                            <ConstraintNode key={c.name}
                                            constraint={c}
                                            selectedConstraint={selectedConstraint}
                                            onSelect={handleSelectContraint}/>
                        ))}
                    </div>
                    <div style={{flex: 4}}>
                        {selectedElement &&
                            <ElementDetailEdit
                                element={selectedElement}
                                dataType={selectedDataType!}
                                xmlPath={selectedXmlPath}/>
                        }
                    </div>
                </div>
            )}
        </div>
    )
}
