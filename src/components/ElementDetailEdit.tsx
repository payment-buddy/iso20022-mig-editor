import type {DataType, ElementOverride, MessageElement, SimpleType} from "../types/types.ts"
import {EditableText} from "./EditableText.tsx"
import {EditableNumber} from "./EditableNumber.tsx"
import {EditableValueList} from "./EditableValueList.tsx"

function createValueValidator(elementOverride: ElementOverride | null, simpleType: SimpleType): (value: string) => boolean {
    const pattern = elementOverride?.pattern ?? simpleType.pattern
    const minLength = elementOverride?.minLength ?? simpleType.minLength ?? simpleType.length
    const maxLength = elementOverride?.maxLength ?? simpleType.maxLength ?? simpleType.length

    return (value: string): boolean => {
        if (minLength != null && value.length < minLength) return false
        if (maxLength != null && value.length > maxLength) return false
        if (pattern != null) {
            try {
                if (!new RegExp('^' + pattern + '$').test(value)) return false
            } catch {
                return false
            }
        }
        return true
    }
}

export function ElementDetailEdit({element, dataType, xmlPath, elementOverride, inheritedOverride, onUpdateOverride, onAddConstraint}: {
    element: MessageElement
    dataType: DataType
    xmlPath: string
    elementOverride: ElementOverride | null
    inheritedOverride: ElementOverride | null
    onUpdateOverride: (xmlPath: string, override: ElementOverride) => void
    onAddConstraint: () => void
}) {
    const simpleType = dataType as SimpleType
    const isSimpleType = !('elements' in dataType)
    const isTextType = 'baseType' in dataType && simpleType.baseType === 'Text'
    const isCodeSetType = 'baseType' in dataType && simpleType.baseType === 'CodeSet'
    const baseExamples = element.examples.length > 0 ? element.examples : (simpleType.examples ?? [])
    
    const baseDefinition = inheritedOverride?.definition || element.definition || dataType.definition
    const baseMinOccurs = inheritedOverride?.minOccurs ?? element.minOccurs
    const baseMaxOccurs = inheritedOverride?.maxOccurs ?? element.maxOccurs
    const baseMinLength = inheritedOverride?.minLength ?? simpleType.minLength ?? simpleType.length
    const baseMaxLength = inheritedOverride?.maxLength ?? simpleType.maxLength ?? simpleType.length
    const basePattern = inheritedOverride?.pattern ?? simpleType.pattern ?? ''
    const baseAllowedValues = inheritedOverride?.allowedValues ?? []
    const effectiveExamples = inheritedOverride?.examples ?? baseExamples

    function buildOverride(updates: Partial<ElementOverride>): ElementOverride {
        return {
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
            ...elementOverride,
            ...updates,
        }
    }

    function saveOverride(updates: Partial<ElementOverride>) {
        const updated = buildOverride(updates)
        onUpdateOverride(xmlPath, updated)
    }

    function saveInt(field: string, original: number | null, val: string) {
        if (val === '') {
            saveOverride({[field]: null})
        } else {
            const num = parseInt(val, 10)
            if (!isNaN(num)) saveOverride({[field]: num === original ? null : num})
        }
    }

    const validateValue = createValueValidator(elementOverride, simpleType)

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
                    value={elementOverride?.definition || baseDefinition}
                    originalValue={baseDefinition}
                    multiline
                    onSave={val => saveOverride({definition: val === baseDefinition ? null : val})}
                />
            </div>
            <div>
                <div className="detail-label">Min Occurs</div>
                <EditableNumber
                    value={elementOverride?.minOccurs ?? baseMinOccurs}
                    originalValue={baseMinOccurs}
                    warnWhen="lower"
                    onSave={val => saveInt('minOccurs', baseMinOccurs, val)}
                />
            </div>
            <div>
                <div className="detail-label">Max Occurs</div>
                <EditableNumber
                    value={elementOverride?.maxOccurs ?? baseMaxOccurs}
                    originalValue={baseMaxOccurs}
                    warnWhen="higher"
                    onSave={val => saveInt('maxOccurs', baseMaxOccurs, val)}
                />
            </div>
            {isTextType && (<>
                <div>
                    <div className="detail-label">Min Length</div>
                    <EditableNumber
                        value={elementOverride?.minLength ?? baseMinLength}
                        originalValue={baseMinLength}
                        warnWhen="lower"
                        onSave={val => saveInt('minLength', baseMinLength, val)}
                    />
                </div>
                <div>
                    <div className="detail-label">Max Length</div>
                    <EditableNumber
                        value={elementOverride?.maxLength ?? baseMaxLength}
                        originalValue={baseMaxLength}
                        warnWhen="higher"
                        onSave={val => saveInt('maxLength', baseMaxLength, val)}
                    />
                </div>
                <div>
                    <div className="detail-label">Pattern</div>
                    <EditableText
                        value={elementOverride?.pattern ?? basePattern}
                        originalValue={basePattern}
                        monospace
                        onSave={val => {
                            saveOverride({pattern: val === (basePattern ?? '') || val === '' ? null : val})
                        }}
                    />
                </div>
            </>)}
            {(isTextType || isCodeSetType) && (
                <div>
                    <div className="detail-label">Allowed Values</div>
                    <EditableValueList
                        values={elementOverride?.allowedValues ?? baseAllowedValues}
                        originalValues={baseAllowedValues}
                        monospace
                        isValueInvalid={v => !validateValue(v)}
                        onSave={values => saveOverride({allowedValues: values.length === 0 ? null : values})}
                    />
                </div>
            )}
            {isSimpleType && (
                <div>
                    <div className="detail-label">Examples</div>
                    <EditableValueList
                        values={elementOverride?.examples ?? effectiveExamples}
                        originalValues={effectiveExamples}
                        monospace
                        isValueInvalid={v => !validateValue(v)}
                        onSave={values => saveOverride({examples: values.length === 0 ? null : values})}
                    />
                </div>
            )}
            <div>
                <button onClick={onAddConstraint}>+ Add constraint</button>
            </div>
        </div>
    )
}
