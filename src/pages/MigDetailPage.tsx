import {stringify} from "yaml";
import type {
    Constraint,
    DataType,
    ElementOverride,
    ERepository,
    MessageDefinition,
    MessageElement,
    MessageImplementationGuide
} from "../types/types.ts";

function buildEmptyOverride(xmlPath: string): ElementOverride {
    return {
        xmlPath,
        definition: null,
        minOccurs: null,
        maxOccurs: null,
        minInclusive: null,
        maxInclusive: null,
        totalDigits: null,
        fractionDigits: null,
        minLength: null,
        maxLength: null,
        pattern: null,
        allowedValues: null,
        examples: null,
        additionalConstraints: null,
    }
}
import {ElementNode} from "../components/ElementNode.tsx";
import {ConstraintNode} from "../components/ConstraintNode.tsx";
import {useState} from "react";
import {ElementDetailEdit} from "../components/ElementDetailEdit.tsx";
import {ConstraintDetailView} from "../components/ConstraintDetailView.tsx";
import {EditableText} from "../components/EditableText.tsx";
import {ConstraintDetailEdit} from "../components/ConstraintDetailEdit.tsx";
import {DetailPanel} from "../components/DetailPanel.tsx";

export function MigDetailPage({mig, eRepository, onUpdate, onDelete}: {
    mig: MessageImplementationGuide,
    eRepository: ERepository,
    onUpdate: (updated: MessageImplementationGuide) => void,
    onDelete: (id: string) => void
}) {
    const [showXmlTags, setShowXmlTags] = useState(false)
    const [hideExcluded, setHideExcluded] = useState(true)
    const [selectedElement, setSelectedElement] = useState<MessageElement | null>(null)
    const [selectedConstraint, setSelectedConstraint] = useState<Constraint | null>(null)
    const [selectedPath, setSelectedPath] = useState<string>('')
    const [selectedDataType, setSelectedDataType] = useState<DataType | null>(null)
    const selectedElementOverride = selectedElement
        ? (mig.elementOverrides.find(o => o.xmlPath === selectedPath) ?? null)
        : null


    let message: MessageDefinition | null = null
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
        const payload = stringify(mig, (_key, val) => {
            if (val === null) return undefined
            if (Array.isArray(val) && val.length === 0) return undefined
            return val
        });
        const blob = new Blob([payload], {type: 'text/yaml'})
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${mig.name}-${mig.version}.yaml`
        a.click()
    }

    function handleSelectElement(element: MessageElement, xmlPath: string) {
        setSelectedElement(element)
        setSelectedConstraint(null)
        setSelectedPath(xmlPath)
        setSelectedDataType(eRepository.dataTypes.get(element.typeId) ?? null)
    }

    function isElementAdditionalConstraint(path: string) {
        return mig.elementOverrides.some(override =>
            override.additionalConstraints?.some(c => `${override.xmlPath}/${c.name}` === path)
        )
    }

    function handleSelectContraint(constraint: Constraint, path: string) {
        setSelectedElement(null)
        setSelectedPath(path)
        setSelectedConstraint(constraint)
        setSelectedDataType(null)
    }

    function handleAddElementConstraint(elementPath: string) {
        const newConstraint: Constraint = {name: 'NewConstraint' + new Date().getTime(), definition: '', expression: ''}
        const existing = mig.elementOverrides.find(o => o.xmlPath === elementPath)
        const override: ElementOverride = {
            ...buildEmptyOverride(elementPath),
            ...existing,
            additionalConstraints: [...(existing?.additionalConstraints ?? []), newConstraint],
        }
        handleUpdateElementOverride(override)
        setSelectedConstraint(newConstraint)
        setSelectedPath(elementPath + '/' + newConstraint.name)
        setSelectedElement(null)
    }

    function isOverrideEmpty(override: ElementOverride) {
        const {xmlPath, allowedValues, examples, additionalConstraints, ...rest} = override
        return (allowedValues == null || allowedValues.length === 0) && (examples == null || examples.length === 0) && (additionalConstraints == null || additionalConstraints.length === 0) && Object.values(rest).every(v => v === null)
    }

    function handleUpdateElementOverride(override: ElementOverride) {
        let elementOverrides: ElementOverride[];
        if (isOverrideEmpty(override)) {
            // Remove empty override
            elementOverrides = mig.elementOverrides.filter(o => o.xmlPath !== override.xmlPath);
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

    function handleUpdateConstraint(updated: Constraint) {
        const oldName = selectedConstraint?.name
        const elementPath = selectedPath.substring(0, selectedPath.lastIndexOf('/'))
        const override = mig.elementOverrides.find(o => o.xmlPath === elementPath)!
        const constraints = (override.additionalConstraints ?? []).map(c => c.name === oldName ? updated : c)
        handleUpdateElementOverride({...override, additionalConstraints: constraints})
        setSelectedConstraint(updated)
        setSelectedPath(elementPath + '/' + updated.name)
    }

    function handleDeleteConstraint() {
        const oldName = selectedConstraint!.name
        const elementPath = selectedPath.substring(0, selectedPath.lastIndexOf('/'))
        const override = mig.elementOverrides.find(o => o.xmlPath === elementPath)!
        const constraints = (override.additionalConstraints ?? []).filter(c => c.name !== oldName)
        handleUpdateElementOverride({...override, additionalConstraints: constraints})
        setSelectedConstraint(null)
        setSelectedPath('')
    }

    return (
        <div>
            <p><a href="#" className="back-link">← Back</a></p>
            <div className="page-header">
                <h2>Message Implementation Guide <code className="badge">{mig.messageIdentifier}</code></h2>
                <div className="page-actions">
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

            <p style={{display: 'flex', gap: '1em', alignItems: 'center'}}>
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
                        checked={hideExcluded}
                        style={{marginRight: '0.5em'}}
                        onChange={() => setHideExcluded(hide => !hide)}/>
                    {(() => {
                        const count = mig.elementOverrides.filter(o => o.maxOccurs === 0).length
                        return `Hide excluded elements (${count})`
                    })()}
                </label>
                <button onClick={() => handleAddElementConstraint('/' + message!.xmlTag)}>+ Add constraint</button>
            </p>

            {message && (
                <div style={{display: 'flex', gap: '1em'}}>
                    <div style={{flex: 3}}>
                        <div>{showXmlTags ? message.xmlTag : message.name}</div>
                        {message.elements.map(element => (
                            <ElementNode key={element.xmlTag}
                                         element={element}
                                         dataTypes={eRepository.dataTypes}
                                         showXmlTags={showXmlTags}
                                         parentPath={'/' + message.xmlTag}
                                         selectedPath={selectedPath}
                                         elementOverrides={mig.elementOverrides}
                                         hideExcluded={hideExcluded}
                                         onSelectElement={handleSelectElement}
                                         onSelectConstraint={handleSelectContraint}/>
                        ))}
                        {message.constraints.map(c => (
                            <ConstraintNode key={c.name}
                                            constraint={c}
                                            parentPath={'/' + message.xmlTag}
                                            selectedPath={selectedPath}
                                            onSelect={handleSelectContraint}/>
                        ))}
                        {mig.elementOverrides.find(o => o.xmlPath === '/' + message.xmlTag)?.additionalConstraints?.map(c => (
                            <ConstraintNode key={c.name}
                                            constraint={c}
                                            parentPath={'/' + message.xmlTag}
                                            selectedPath={selectedPath}
                                            onSelect={handleSelectContraint}/>
                        ))}
                    </div>
                    <DetailPanel>
                        {selectedElement &&
                            <ElementDetailEdit
                                element={selectedElement}
                                dataType={selectedDataType!}
                                xmlPath={selectedPath}
                                elementOverride={selectedElementOverride}
                                onUpdateOverride={handleUpdateElementOverride}
                                onAddConstraint={() => handleAddElementConstraint(selectedPath)}/>
                        }
                        {selectedConstraint && (isElementAdditionalConstraint(selectedPath)
                                ? <ConstraintDetailEdit constraint={selectedConstraint}
                                                        onUpdate={handleUpdateConstraint}
                                                        onDelete={handleDeleteConstraint}/>
                                : <ConstraintDetailView constraint={selectedConstraint}/>)
                        }
                    </DetailPanel>
                </div>
            )}
        </div>
    )
}
