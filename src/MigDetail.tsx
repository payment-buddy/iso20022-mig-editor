import {stringify} from "yaml";
import type {
    Constraint,
    DataType,
    ElementOverride,
    ERepository,
    MessageElement,
    MessageImplementationGuideline
} from "./types.ts";
import {ElementNode} from "./ElementNode.tsx";
import {ConstraintNode} from "./ConstraintNode.tsx";
import {useState} from "react";
import {ElementDetailEdit} from "./ElementDetailEdit.tsx";
import {ConstraintDetail} from "./ConstraintDetail.tsx";
import {EditableText} from "./EditableText.tsx";

export function MigDetail({mig, eRepository, onUpdate, onDelete}: {
    mig: MessageImplementationGuideline,
    eRepository: ERepository,
    onUpdate: (updated: MessageImplementationGuideline) => void,
    onDelete: (id: string) => void
}) {
    const [showXmlTags, setShowXmlTags] = useState(false)
    const [showExcluded, setShowExcluded] = useState(false)
    const [selectedElement, setSelectedElement] = useState<MessageElement | null>(null)
    const [selectedConstraint, setSelectedConstraint] = useState<Constraint | null>(null)
    const [selectedXmlPath, setSelectedXmlPath] = useState<string>('')
    const [selectedDataType, setSelectedDataType] = useState<DataType | null>(null)
    const [selectedElementOverride, setSelectedElementOverride] = useState<ElementOverride | null>(null)


    let message = null
    for (const ba of eRepository.businessAreas) {
        const found = ba.messages.find(m => m.identifier === mig.messageIdentifier)
        if (found) {
            message = found;
            break
        }
    }

    function handleDelete() {
        const download = window.confirm(`Delete "${mig.name}"?\n\nClick OK to delete. If you want to keep a copy, cancel and use the Download button first.`)
        if (!download) return
        const wantDownload = window.confirm('Download a copy before deleting?')
        if (wantDownload) handleDownload()
        onDelete(mig.id)
    }

    function handleDownload() {
        const blob = new Blob([stringify(mig, (_key, val) => val === null ? undefined : val)], {type: 'text/yaml'})
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${mig.name}-${mig.version}.yaml`
        a.click()
    }

    function handleSelectElement(element: MessageElement, xmlPath: string) {
        setSelectedElement(element)
        setSelectedConstraint(null)
        setSelectedXmlPath(xmlPath)
        setSelectedDataType(eRepository.dataTypes.get(element.typeId) ?? null)
        setSelectedElementOverride(mig.elementOverrides.find(override => override.xmlPath === xmlPath) ?? null)
    }

    function isOverrideEmpty(override: ElementOverride) {
        const {xmlPath, codes, additionalConstraints, ...rest} = override
        return codes.length === 0 && additionalConstraints.length === 0 && Object.values(rest).every(v => v === null)
    }

    function handleUpdateElementOverride(override: ElementOverride) {
        setSelectedElementOverride(override)
        let elementOverrides: ElementOverride[];
        if (isOverrideEmpty(override)) {
            // Remove empty override
            elementOverrides = mig.elementOverrides.filter(o => o.xmlPath !== selectedXmlPath);
        } else {
            const exists = mig.elementOverrides.some(o => o.xmlPath === override.xmlPath)
            if (exists) {
                // Replace existing override
                elementOverrides = mig.elementOverrides.map(o => o.xmlPath === override.xmlPath ? override : o);
            } else {
                // Add new override
                elementOverrides = [...mig.elementOverrides, override];
            }
        }
        onUpdate({...mig, elementOverrides})
    }

    function handleSelectContraint(constraint: Constraint) {
        setSelectedElement(null)
        setSelectedXmlPath('')
        setSelectedConstraint(constraint)
        setSelectedDataType(null)
    }

    return (
        <div>
            <p><a href="#">← Back</a></p>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                <h2>Message Implementation Guildeline <code style={{
                    marginLeft: '0.2rem',
                    padding: '0.1em 0.4em',
                    border: '#999 solid 1px',
                    borderRadius: 3,
                    fontSize: '1em',
                }}>{mig.messageIdentifier}</code></h2>
                <div style={{display: 'flex', gap: '0.5em'}}>
                    <button onClick={handleDownload}>Download</button>
                    <button onClick={handleDelete}>Delete</button>
                </div>
            </div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'max-content 1fr',
                alignItems: 'center',
                gap: '0.25em 0.5em'
            }}>
                <label>Name:</label>
                <EditableText
                    value={mig.name}
                    isOverridden={false}
                    onSave={val => { if (val !== mig.name) onUpdate({...mig, name: val}) }}
                />
                <label>Version:</label>
                <EditableText
                    value={mig.version}
                    isOverridden={false}
                    onSave={val => { if (val !== mig.version) onUpdate({...mig, version: val}) }}
                />
                <label style={{alignSelf: 'start', paddingTop: '0.2em'}}>Description:</label>
                <EditableText
                    value={mig.description ?? ''}
                    isOverridden={false}
                    multiline
                    onSave={val => { if (val !== (mig.description ?? '')) onUpdate({...mig, description: val || null}) }}
                />
            </div>

            <p style={{display: 'flex', gap: '1em'}}>
                <label>
                    <input
                        type="checkbox"
                        checked={showXmlTags}
                        style={{marginRight: '0.5em'}}
                        onChange={() => setShowXmlTags(show => !show)}/>
                    Show XML tags
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={showExcluded}
                        style={{marginRight: '0.5em'}}
                        onChange={() => setShowExcluded(show => !show)}/>
                    Show excluded elements
                </label>
            </p>

            {message && (
                <div style={{display: 'flex', gap: '1em'}}>
                    <div style={{flex: 3}}>
                        <div>{showXmlTags ? message.xmlTag : message.name}</div>
                        {message.elements.map(element => (
                            <ElementNode key={element.id}
                                         element={element}
                                         selectedElement={selectedElement}
                                         selectedConstraint={selectedConstraint}
                                         dataTypes={eRepository.dataTypes}
                                         showXmlTags={showXmlTags}
                                         xmlPath={'/' + message.xmlTag}
                                         selectedXmlPath={selectedXmlPath}
                                         elementOverrides={mig.elementOverrides}
                                         showExcluded={showExcluded}
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
                                xmlPath={selectedXmlPath}
                                elementOverride={selectedElementOverride}
                                onUpdateOverride={handleUpdateElementOverride}/>
                        }
                        {selectedConstraint &&
                            <ConstraintDetail constraint={selectedConstraint}/>}
                    </div>
                </div>
            )}
        </div>
    )
}
