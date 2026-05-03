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
import {Modal} from "../components/Modal.tsx"

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
    const [showDeleteModal, setShowDeleteModal] = useState(false)
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
        setShowDeleteModal(true)
    }

    function confirmDelete() {
        setShowDeleteModal(false)
        onDelete(mig.id)
    }

    async function handleDownload() {
        await downloadYaml(mig, `${mig.name}-${mig.version}.yaml`)
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

    function isCurrentMigConstraint(path: string) {
        const elementPath = path.substring(0, path.lastIndexOf('/'))
        const constraintName = path.substring(path.lastIndexOf('/') + 1)
        const override = mig.elementOverrides[elementPath]
        return override?.additionalConstraints?.some(c => c.name === constraintName) ?? false
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
        const {allowedValues, examples, additionalConstraints, customProperties, ...rest} = override
        const customPropsEmpty = customProperties == null || Object.keys(customProperties).length === 0
        return (allowedValues == null || allowedValues.length === 0) && (examples == null || examples.length === 0) && (additionalConstraints == null || additionalConstraints.length === 0) && customPropsEmpty && Object.values(rest).every(v => v === null)
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

    function handleCustomElementPropertyNamesUpdate(val: string) {
        const trimmed = val.trim()
        const updated = {...mig}
        if (!trimmed) {
            delete updated.customElementPropertyNames
        } else {
            updated.customElementPropertyNames = trimmed
        }
        if (JSON.stringify(updated) !== JSON.stringify(mig)) {
            onUpdate(updated)
        }
    }

    function handleCustomConstraintPropertyNamesUpdate(val: string) {
        const trimmed = val.trim()
        const updated = {...mig}
        if (!trimmed) {
            delete updated.customConstraintPropertyNames
        } else {
            updated.customConstraintPropertyNames = trimmed
        }
        if (JSON.stringify(updated) !== JSON.stringify(mig)) {
            onUpdate(updated)
        }
    }

    function handleDescriptionUpdate(val: string) {
        if (val !== (mig.description ?? '')) {
            onUpdate({...mig, description: val || null})
        }
    }

    return (
        <div>
            <a href="#" className="back-link">← Back</a>
            <div className="page-header">
                <h2>Message Implementation Guide <code className="badge"><a
                    href={'#' + mig.messageIdentifier}>{mig.messageIdentifier}</a></code></h2>
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
                <label className="detail-label">Name:</label>
                <EditableText
                    value={mig.name}
                    onSave={val => {
                        if (val !== mig.name) onUpdate({...mig, name: val})
                    }}
                />
                <label className="detail-label">Version:</label>
                <EditableText
                    value={mig.version}
                    onSave={val => {
                        if (val !== mig.version) onUpdate({...mig, version: val})
                    }}
                />
                <label className="detail-label">Parent MIG:</label>
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
                <label className="detail-label" style={{alignSelf: 'start', paddingTop: '0.1em'}}>Description:</label>
                <EditableText value={mig.description} multiline onSave={handleDescriptionUpdate}/>
                <label className="detail-label" style={{alignSelf: 'start', paddingTop: '0.1em'}}>Custom Element
                    Properties:</label>
                <EditableText
                    value={mig.customElementPropertyNames ?? ''}
                    multiline
                    onSave={handleCustomElementPropertyNamesUpdate}
                />
                <label className="detail-label" style={{alignSelf: 'start', paddingTop: '0.1em'}}>Custom Constraint
                    Properties:</label>
                <EditableText
                    value={mig.customConstraintPropertyNames ?? ''}
                    multiline
                    onSave={handleCustomConstraintPropertyNamesUpdate}
                />
            </div>

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
                                onAddConstraint={() => handleAddElementConstraint(selectedPath)}
                                customElementPropertyNames={mig.customElementPropertyNames ?? ''}/>
                        }
                        {selectedConstraint && (isElementAdditionalConstraint(selectedPath)
                            ? <ConstraintDetailEdit constraint={selectedConstraint}
                                                    onUpdate={handleUpdateConstraint}
                                                    onDelete={handleDeleteConstraint}
                                                    isNew={selectedConstraint.name === newConstraintId}
                                                    customConstraintPropertyNames={mig.customConstraintPropertyNames ?? ''}
                                                    isInherited={!isCurrentMigConstraint(selectedPath)}/>
                            : <ConstraintDetailView constraint={selectedConstraint}
                                                    customConstraintPropertyNames={mig.customConstraintPropertyNames ?? ''}/>)
                        }
                    </DetailPanel>
                </div>
            )}
            {showDeleteModal && (
                <Modal
                    onClose={() => setShowDeleteModal(false)}
                    footer={
                        <>
                            <button type="button" onClick={() => confirmDelete()}>Delete</button>
                            <button type="button" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                        </>
                    }
                >
                    <p>Delete <code>{mig.name}</code>?</p>
                    <p>You may want to <a href="#" onClick={async (e) => {
                        e.preventDefault()
                        await handleDownload()
                    }}>download</a> a reserve copy first.</p>
                </Modal>
            )}
        </div>
    )
}
