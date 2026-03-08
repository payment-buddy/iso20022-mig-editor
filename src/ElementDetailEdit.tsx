import {useState} from "react";
import type {DataType, ElementOverride, MessageElement} from "./types.ts";

export function ElementDetailEdit({element, dataType, xmlPath, elementOverride, onUpdateOverride}: {
    element: MessageElement
    dataType: DataType
    xmlPath: string
    elementOverride: ElementOverride | null
    onUpdateOverride: (override: ElementOverride | null) => void
}) {
    const [editingDefinition, setEditingDefinition] = useState(false)
    const [editingMinOccurs, setEditingMinOccurs] = useState(false)
    const [editingMaxOccurs, setEditingMaxOccurs] = useState(false)
    const [definitionValue, setDefinitionValue] = useState('')
    const [minOccursValue, setMinOccursValue] = useState('')
    const [maxOccursValue, setMaxOccursValue] = useState('')

    function buildOverride(updates: Partial<ElementOverride>): ElementOverride {
        return {
            xmlPath,
            definition: null,
            minOccurs: null,
            maxOccurs: null,
            minInclusive: null,
            maxInclusive: null,
            totalDigits: null,
            fractionDigits: null,
            length: null,
            minLength: null,
            maxLength: null,
            pattern: null,
            codes: [],
            additionalConstraints: [],
            ...elementOverride,
            ...updates,
        }
    }

    function isOverrideEmpty(o: ElementOverride) {
        return o.definition === null &&
            o.minOccurs === null &&
            o.maxOccurs === null &&
            o.minInclusive === null &&
            o.maxInclusive === null &&
            o.totalDigits === null &&
            o.fractionDigits === null &&
            o.length === null &&
            o.minLength === null &&
            o.maxLength === null &&
            o.pattern === null &&
            o.codes.length === 0 &&
            o.additionalConstraints.length === 0
    }

    function saveOverride(updates: Partial<ElementOverride>) {
        const updated = buildOverride(updates)
        onUpdateOverride(isOverrideEmpty(updated) ? null : updated)
    }

    function startEditDefinition() {
        setDefinitionValue(elementOverride?.definition ?? element.definition)
        setEditingDefinition(true)
    }

    function handleDefinitionSave() {
        setEditingDefinition(false)
        const val = definitionValue.trim()
        saveOverride({definition: val === element.definition ? null : val})
    }

    function startEditMinOccurs() {
        setMinOccursValue(String(elementOverride?.minOccurs ?? element.minOccurs))
        setEditingMinOccurs(true)
    }

    function handleMinOccursSave() {
        setEditingMinOccurs(false)
        const num = parseInt(minOccursValue, 10)
        if (isNaN(num)) return
        saveOverride({minOccurs: num === element.minOccurs ? null : num})
    }

    function startEditMaxOccurs() {
        setMaxOccursValue(String(elementOverride?.maxOccurs ?? element.maxOccurs))
        setEditingMaxOccurs(true)
    }

    function handleMaxOccursSave() {
        setEditingMaxOccurs(false)
        const num = parseInt(maxOccursValue, 10)
        if (isNaN(num)) return
        saveOverride({maxOccurs: num === element.maxOccurs ? null : num})
    }

    const overriddenStyle = {color: '#0066cc'}

    return (
        <div>
            <div>
                <div>XML Tag</div>
                <div>{element.xmlTag}</div>
            </div>
            <div>
                <div>XML Path</div>
                <div>{xmlPath}</div>
            </div>
            <div>
                <div>Type</div>
                <div>{dataType.name}</div>
            </div>
            <div>
                <div>Definition</div>
                {editingDefinition ? (
                    <textarea
                        autoFocus
                        value={definitionValue}
                        onChange={e => setDefinitionValue(e.target.value)}
                        onBlur={handleDefinitionSave}
                        onKeyDown={e => {
                            if (e.key === 'Escape') setEditingDefinition(false)
                        }}
                        style={{resize: 'vertical', minHeight: '4em', width: '100%'}}
                    />
                ) : (
                    <span
                        style={{cursor: 'pointer', whiteSpace: 'pre-wrap', ...(elementOverride?.definition != null ? overriddenStyle : {})}}
                        onClick={startEditDefinition}
                    >
                        {elementOverride?.definition ?? element.definition}
                    </span>
                )}
            </div>
            <div>
                <div>Min Occurs</div>
                {editingMinOccurs ? (
                    <input
                        autoFocus
                        type="number"
                        value={minOccursValue}
                        onChange={e => setMinOccursValue(e.target.value)}
                        onBlur={handleMinOccursSave}
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleMinOccursSave()
                            if (e.key === 'Escape') setEditingMinOccurs(false)
                        }}
                    />
                ) : (
                    <span
                        style={{cursor: 'pointer', ...(elementOverride?.minOccurs != null ? overriddenStyle : {})}}
                        onClick={startEditMinOccurs}
                    >
                        {elementOverride?.minOccurs ?? element.minOccurs}
                    </span>
                )}
            </div>
            <div>
                <div>Max Occurs</div>
                {editingMaxOccurs ? (
                    <input
                        autoFocus
                        type="number"
                        value={maxOccursValue}
                        onChange={e => setMaxOccursValue(e.target.value)}
                        onBlur={handleMaxOccursSave}
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleMaxOccursSave()
                            if (e.key === 'Escape') setEditingMaxOccurs(false)
                        }}
                    />
                ) : (
                    <span
                        style={{cursor: 'pointer', ...(elementOverride?.maxOccurs != null ? overriddenStyle : {})}}
                        onClick={startEditMaxOccurs}
                    >
                        {elementOverride?.maxOccurs ?? element.maxOccurs}
                    </span>
                )}
            </div>
        </div>
    )
}
