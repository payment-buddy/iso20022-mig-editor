import type {DataType, ElementOverride, MessageElement, Simpletype} from "../types/types.ts";
import {EditableText} from "./EditableText.tsx";
import {EditableNumber} from "./EditableNumber.tsx";

export function ElementDetailEdit({element, dataType, xmlPath, elementOverride, onUpdateOverride, onAddConstraint}: {
    element: MessageElement
    dataType: DataType
    xmlPath: string
    elementOverride: ElementOverride | null
    onUpdateOverride: (override: ElementOverride) => void
    onAddConstraint: () => void
}) {
    const simpleType = dataType as Simpletype
    const isTextType = 'baseType' in dataType && simpleType.baseType === 'Text'
    const isCodeSetType = 'baseType' in dataType && simpleType.baseType === 'CodeSet'
    const baseExamples = element.examples.length > 0 ? element.examples : (simpleType.examples ?? [])

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
            minLength: null,
            maxLength: null,
            pattern: null,
            allowedValues: [],
            examples: null,
            additionalConstraints: [],
            ...elementOverride,
            ...updates,
        }
    }

    function saveOverride(updates: Partial<ElementOverride>) {
        const updated = buildOverride(updates)
        onUpdateOverride(updated)
    }

    function saveInt(field: string, original: number | null, val: string) {
        if (val === '') {
            saveOverride({[field]: null})
        } else {
            const num = parseInt(val, 10)
            if (!isNaN(num)) saveOverride({[field]: num === original ? null : num})
        }
    }

    return (
        <div className="detail-panel">
            <div>
                <div className="detail-label">{element.isAttribute ? 'XML Attribute' : 'XML Tag'}</div>
                <div>{element.xmlTag}</div>
            </div>
            <div>
                <div className="detail-label">XML Path</div>
                <div>{xmlPath}</div>
            </div>
            <div>
                <div className="detail-label">Type</div>
                <div>{dataType.name} {simpleType?.baseType && <span>({simpleType.baseType})</span>}</div>
            </div>
            <div>
                <div className="detail-label">Definition</div>
                <EditableText
                    value={elementOverride?.definition || element.definition || dataType.definition}
                    isOverridden={elementOverride?.definition != null}
                    multiline
                    onSave={val => saveOverride({definition: val === element.definition ? null : val})}
                />
            </div>
            <div>
                <div className="detail-label">Min Occurs</div>
                <EditableNumber
                    value={elementOverride?.minOccurs ?? element.minOccurs}
                    originalValue={element.minOccurs}
                    warnWhen="lower"
                    onSave={val => saveInt('minOccurs', element.minOccurs, val)}
                />
            </div>
            <div>
                <div className="detail-label">Max Occurs</div>
                <EditableNumber
                    value={elementOverride?.maxOccurs ?? element.maxOccurs}
                    originalValue={element.maxOccurs}
                    warnWhen="higher"
                    onSave={val => saveInt('maxOccurs', element.maxOccurs, val)}
                />
            </div>
            {isTextType && (<>
                <div>
                    <div className="detail-label">Min Length</div>
                    <EditableNumber
                        value={elementOverride?.minLength ?? simpleType.minLength ?? simpleType.length}
                        originalValue={simpleType.minLength ?? simpleType.length}
                        warnWhen="lower"
                        onSave={val => saveInt('minLength', simpleType.minLength, val)}
                    />
                </div>
                <div>
                    <div className="detail-label">Max Length</div>
                    <EditableNumber
                        value={elementOverride?.maxLength ?? simpleType.maxLength ?? simpleType.length}
                        originalValue={simpleType.maxLength ?? simpleType.length}
                        warnWhen="higher"
                        onSave={val => saveInt('maxLength', simpleType.maxLength, val)}
                    />
                </div>
                <div>
                    <div className="detail-label">Pattern</div>
                    <EditableText
                        value={elementOverride?.pattern ?? simpleType.pattern ?? ''}
                        isOverridden={elementOverride?.pattern != null}
                        monospace
                        onSave={val => {
                            const original = simpleType.pattern ?? null
                            saveOverride({pattern: val === (original ?? '') || val === '' ? null : val})
                        }}
                    />
                </div>
            </>)}
            {(isTextType || isCodeSetType) && (
                <div>
                    <div className="detail-label">Allowed Values</div>
                    <EditableText
                        value={elementOverride?.allowedValues?.join('\n') ?? ''}
                        isOverridden={elementOverride?.allowedValues != null && elementOverride.allowedValues.length > 0}
                        multiline
                        monospace
                        onSave={val => {
                            const values = val.split('\n').map(s => s.trim()).filter(Boolean)
                            saveOverride({allowedValues: values.length === 0 ? null : values})
                        }}
                    />
                </div>
            )}
            <div>
                <div className="detail-label">Examples</div>
                <EditableText
                    value={(elementOverride?.examples ?? baseExamples).join('\n')}
                    isOverridden={elementOverride?.examples != null && elementOverride.examples.length > 0}
                    multiline
                    monospace
                    onSave={val => {
                        const values = val.split('\n').map(s => s.trim()).filter(Boolean)
                        saveOverride({examples: values.length === 0 ? null : values})
                    }}
                />
            </div>
            <div>
                <button onClick={onAddConstraint}>+ Add constraint</button>
            </div>
        </div>
    )
}
