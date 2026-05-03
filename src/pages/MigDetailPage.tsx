import {downloadYaml} from "../utils/downloadYaml"
import {getCombinedOverrides, getParentOptions} from "../utils/migUtils.ts"
import type {
    Constraint,
    ElementOverride,
    ERepository,
    MessageDefinition,
    MessageElement,
    MessageImplementationGuide
} from "../types/types.ts"
import {useState} from "react"
import {ElementDetailEdit} from "../components/ElementDetailEdit.tsx"
import {ConstraintDetailView} from "../components/ConstraintDetailView.tsx"
import {EditableText} from "../components/EditableText.tsx"
import {EditableSelect} from "../components/EditableSelect.tsx"
import {ConstraintDetailEdit} from "../components/ConstraintDetailEdit.tsx"
import {DetailPanel} from "../components/DetailPanel.tsx"
import {MessageTreeView} from "../components/MessageTreeView.tsx"

export function MigDetailPage({mig, migs, eRepository, onUpdate, onDelete}: {
    mig: MessageImplementationGuide,
    migs: MessageImplementationGuide[],
    eRepository: ERepository,
    onUpdate: (updated: MessageImplementationGuide) => void,
    onDelete: (id: string) => void
}) {
    const [showXmlTags, setShowXmlTags] = useState(false)
    const [hideExcluded, setHideExcluded] = useState(true)
    const [filter, setFilter] = useState('')
    const [selectedElement, setSelectedElement] = useState<MessageElement | null>(null)
    const [selectedConstraint, setSelectedConstraint] = useState<Constraint | null>(null)
    const [selectedPath, setSelectedPath] = useState<string>('')
    const [newConstraintId, setNewConstraintId] = useState<string | null>(null)
    const combinedOverrides = getCombinedOverrides(mig, migs)
    const inheritedOverrides = mig.parentMIG ? getCombinedOverrides(migs.find(m => m.id === mig.parentMIG)!, migs) : {}
    const selectedElementOverride = mig.elementOverrides[selectedPath] ?? null
    const selectedInheritedOverride = inheritedOverrides[selectedPath] ?? null
    const selectedDataType = selectedElement ? eRepository.dataTypes[selectedElement.typeId] ?? null : null
    const excludedCount = Object.values(combinedOverrides).filter(o => o.maxOccurs === 0).length

    const parentOptions = getParentOptions(mig, migs)
    const isParentMissing = mig.parentMIG && !migs.some(m => m.id === mig.parentMIG)

    let message: MessageDefinition | null = null
    for (const ba of eRepository.businessAreas) {
        const found = ba.messages.find(m => m.identifier === mig.messageIdentifier)
        if (found) {
            message = found
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
        downloadYaml(mig, `${mig.name}-${mig.version}.yaml`)
    }

    function handleSelectElement(element: MessageElement, xmlPath: string) {
        setSelectedElement(element)
        setSelectedConstraint(null)
        setSelectedPath(xmlPath)
    }

    function isElementAdditionalConstraint(path: string) {
        return Object.entries(combinedOverrides).some(([xmlPath, override]) =>
            override.additionalConstraints?.some(c => `${xmlPath}/${c.name}` === path)
        )
    }

    function handleSelectConstraint(constraint: Constraint, path: string) {
        setSelectedElement(null)
        setSelectedPath(path)
        setSelectedConstraint(constraint)
    }

    function handleAddElementConstraint(elementPath: string) {
        const constraintName = (selectedElement?.name ?? 'New') + 'Rule'
        const newConstraint: Constraint = {name: constraintName, definition: '', expression: ''}
        const existingOverride = mig.elementOverrides[elementPath]
        const override: ElementOverride = {
            ...existingOverride,
            additionalConstraints: [...(existingOverride?.additionalConstraints ?? []), newConstraint],
        }
        handleUpdateElementOverride(elementPath, override)
        setSelectedConstraint(newConstraint)
        setSelectedPath(elementPath + '/' + newConstraint.name)
        setSelectedElement(null)
        setNewConstraintId(newConstraint.name)
    }

    function isOverrideEmpty(override: ElementOverride) {
        const {allowedValues, examples, additionalConstraints, ...rest} = override
        return (allowedValues == null || allowedValues.length === 0) && (examples == null || examples.length === 0) && (additionalConstraints == null || additionalConstraints.length === 0) && Object.values(rest).every(v => v === null)
    }

    function handleUpdateElementOverride(xmlPath: string, override: ElementOverride) {
        const elementOverrides = {...mig.elementOverrides}
        if (isOverrideEmpty(override)) {
            delete elementOverrides[xmlPath]
        } else {
            elementOverrides[xmlPath] = override
        }
        onUpdate({...mig, elementOverrides})
    }

    function handleUpdateConstraint(updated: Constraint) {
        const oldName = selectedConstraint?.name
        const elementPath = selectedPath.substring(0, selectedPath.lastIndexOf('/'))
        const override = mig.elementOverrides[elementPath]!
        const constraints = (override.additionalConstraints ?? []).map(c => c.name === oldName ? updated : c)
        handleUpdateElementOverride(elementPath, {...override, additionalConstraints: constraints})
        setSelectedConstraint(updated)
        setSelectedPath(elementPath + '/' + updated.name)
        setNewConstraintId(null)
    }

    function handleDeleteConstraint() {
        const oldName = selectedConstraint!.name
        const elementPath = selectedPath.substring(0, selectedPath.lastIndexOf('/'))
        const override = mig.elementOverrides[elementPath]!
        const constraints = (override.additionalConstraints ?? []).filter(c => c.name !== oldName)
        handleUpdateElementOverride(elementPath, {...override, additionalConstraints: constraints})
        setSelectedConstraint(null)
        setSelectedPath('')
        setNewConstraintId(null)
    }

    return (
        <div>
            <p><a href="#" className="back-link">← Back</a></p>
            <div className="page-header">
                <h2>Message Implementation Guide <code className="badge"><a href={'#' + mig.messageIdentifier}>{mig.messageIdentifier}</a></code></h2>
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
                    onSave={val => { if (val !== mig.name) onUpdate({...mig, name: val}) }}
                />
                <label>Version:</label>
                <EditableText
                    value={mig.version}
                    onSave={val => { if (val !== mig.version) onUpdate({...mig, version: val}) }}
                />
                <label>Parent MIG:</label>
                <div style={{display: 'flex', flexDirection: 'column', gap: '0.5em'}}>
                    <EditableSelect
                        value={mig.parentMIG}
                        options={parentOptions}
                        onSave={val => onUpdate({...mig, parentMIG: val})}
                        missingValue={mig.parentMIG}
                    />
                    {isParentMissing && (
                        <div style={{color: 'red', fontSize: '0.9em'}}>
                            The selected parent MIG is missing. Please upload it.
                        </div>
                    )}
                </div>
                <label style={{alignSelf: 'start', paddingTop: '0.2em'}}>Description:</label>
                <EditableText
                    value={mig.description ?? ''}
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
                    Hide excluded elements ({excludedCount})
                </label>
                <label>
                    Filter:
                    <input
                        type="text"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        style={{marginLeft: '0.5em'}}
                    />
                </label>
            </p>

            {message && (
                <div style={{display: 'flex', gap: '1em'}}>
                    <MessageTreeView
                        message={message}
                        dataTypes={eRepository.dataTypes}
                        elementOverrides={combinedOverrides}
                        hideExcluded={hideExcluded}
                        showXmlTags={showXmlTags}
                        filter={filter}
                        selectedPath={selectedPath}
                        onSelectElement={handleSelectElement}
                        onSelectConstraint={handleSelectConstraint}
                    />
                    <DetailPanel>
                        {selectedElement &&
                            <ElementDetailEdit
                                element={selectedElement}
                                dataType={selectedDataType!}
                                xmlPath={selectedPath}
                                elementOverride={selectedElementOverride}
                                inheritedOverride={selectedInheritedOverride}
                                onUpdateOverride={handleUpdateElementOverride}
                                onAddConstraint={() => handleAddElementConstraint(selectedPath)}/>
                        }
                        {selectedConstraint && (isElementAdditionalConstraint(selectedPath)
                            ? <ConstraintDetailEdit constraint={selectedConstraint}
                                                    onUpdate={handleUpdateConstraint}
                                                    onDelete={handleDeleteConstraint}
                                                    isNew={selectedConstraint.name === newConstraintId}/>
                            : <ConstraintDetailView constraint={selectedConstraint}/>)
                        }
                    </DetailPanel>
                </div>
            )}
        </div>
    )
}
