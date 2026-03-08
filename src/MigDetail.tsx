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
    const [editingName, setEditingName] = useState(false)
    const [editingVersion, setEditingVersion] = useState(false)
    const [editingDescription, setEditingDescription] = useState(false)
    const [nameValue, setNameValue] = useState('')
    const [versionValue, setVersionValue] = useState('')
    const [descriptionValue, setDescriptionValue] = useState('')


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

    function startEditName() {
        setNameValue(mig.name)
        setEditingName(true)
    }

    function handleNameSave() {
        setEditingName(false)
        if (nameValue !== mig.name) onUpdate({...mig, name: nameValue})
    }

    function startEditVersion() {
        setVersionValue(mig.version)
        setEditingVersion(true)
    }

    function handleVersionSave() {
        setEditingVersion(false)
        if (versionValue !== mig.version) onUpdate({...mig, version: versionValue})
    }

    function startEditDescription() {
        setDescriptionValue(mig.description ?? '')
        setEditingDescription(true)
    }

    function handleDescriptionSave() {
        setEditingDescription(false)
        const val = descriptionValue.trim()
        if (val !== (mig.description ?? '')) onUpdate({...mig, description: val || null})
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
                {editingName ? (
                    <input
                        autoFocus
                        value={nameValue}
                        onChange={e => setNameValue(e.target.value)}
                        onBlur={handleNameSave}
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleNameSave();
                            if (e.key === 'Escape') setEditingName(false)
                        }}
                    />
                ) : (
                    <span style={{cursor: 'pointer'}} onClick={startEditName}>{mig.name}</span>
                )}
                <label>Version:</label>
                {editingVersion ? (
                    <input
                        autoFocus
                        value={versionValue}
                        onChange={e => setVersionValue(e.target.value)}
                        onBlur={handleVersionSave}
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleVersionSave();
                            if (e.key === 'Escape') setEditingVersion(false)
                        }}
                    />
                ) : (
                    <span style={{cursor: 'pointer'}} onClick={startEditVersion}>{mig.version}</span>
                )}
                <label style={{alignSelf: 'start', paddingTop: '0.2em'}}>Description:</label>
                {editingDescription ? (
                    <textarea
                        autoFocus
                        value={descriptionValue}
                        onChange={e => setDescriptionValue(e.target.value)}
                        onBlur={handleDescriptionSave}
                        onKeyDown={e => {
                            if (e.key === 'Escape') {
                                setEditingDescription(false)
                            }
                        }}
                        style={{resize: 'vertical', minHeight: '4em'}}
                    />
                ) : (
                    <span style={{cursor: 'pointer', whiteSpace: 'pre-wrap'}} onClick={startEditDescription}>
                        {mig.description || <em style={{color: '#999'}}>Click to add description</em>}
                    </span>
                )}
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
                    </div>
                </div>
            )}
        </div>
    )
}
