import type {DataType, ElementOverride, MessageElement, SimpleType} from "../types/types.ts"
import {splitCamelCase} from "../utils/stringUtils.ts"
import {isValidXsdPattern} from "../utils/regexUtils.ts"
import {EditableField} from "./EditableField.tsx"
import {EditableList} from "./EditableList.tsx"

function createValueValidator(elementOverride: ElementOverride | null, simpleType: SimpleType): (value: string) => string | null {
    const pattern = elementOverride?.pattern ?? simpleType.pattern ?? undefined
    const minLength = elementOverride?.minLength ?? simpleType.minLength ?? simpleType.length
    const maxLength = elementOverride?.maxLength ?? simpleType.maxLength ?? simpleType.length

    return (value: string): string | null => {
        if (minLength != null && value.length < minLength) return "Shorter than minLength"
        if (maxLength != null && value.length > maxLength) return "Longer than maxLength"
        if (pattern != undefined) {
            try {
                const regexp = new RegExp('^' + pattern + '$', 'u')
                return regexp.test(value) ? null : 'Does not match pattern ' + pattern
            } catch {
                return null // Cannot validate - bad pattern
            }
        }
        return null
    }
}

export function ElementDetailEdit({
                                      element,
                                      dataType,
                                      xmlPath,
                                      elementOverride,
                                      inheritedOverride,
                                      onUpdateOverride,
                                      onAddConstraint,
                                      customElementPropertyNames
                                  }: {
    element: MessageElement
    dataType: DataType
    xmlPath: string
    elementOverride: ElementOverride | null
    inheritedOverride: ElementOverride | null
    onUpdateOverride: (xmlPath: string, override: ElementOverride) => void
    onAddConstraint: () => void
    customElementPropertyNames?: string[]
}) {
    const simpleType = dataType as SimpleType
    const baseType = simpleType.baseType
    const isSimpleType = !('elements' in dataType)
    const baseExamples = element.examples.length > 0 ? element.examples : (simpleType.examples ?? [])

    const baseDefinition = inheritedOverride?.definition ?? element.definition ?? dataType.definition
    const baseMinOccurs = inheritedOverride?.minOccurs ?? element.minOccurs ?? undefined
    const baseMaxOccurs = inheritedOverride?.maxOccurs ?? element.maxOccurs ?? undefined
    const baseMinInclusive = inheritedOverride?.minInclusive ?? simpleType.minInclusive ?? undefined
    const baseMaxInclusive = inheritedOverride?.maxInclusive ?? simpleType.maxInclusive ?? undefined
    const baseTotalDigits = inheritedOverride?.totalDigits ?? simpleType.totalDigits ?? undefined
    const baseFractionDigits = inheritedOverride?.fractionDigits ?? simpleType.fractionDigits ?? undefined
    const baseMinLength = inheritedOverride?.minLength ?? simpleType.minLength ?? simpleType.length ?? undefined
    const baseMaxLength = inheritedOverride?.maxLength ?? simpleType.maxLength ?? simpleType.length ?? undefined
    const basePattern = inheritedOverride?.pattern ?? simpleType.pattern ?? undefined
    const baseAllowedValues = inheritedOverride?.allowedValues ?? []

    const effectiveExamples = inheritedOverride?.examples ?? baseExamples
    const effectiveMinOccurs = elementOverride?.minOccurs ?? baseMinOccurs
    const effectiveMaxOccurs = elementOverride?.maxOccurs ?? baseMaxOccurs
    const effectiveMinInclusive = elementOverride?.minInclusive ?? baseMinInclusive
    const effectiveMaxInclusive = elementOverride?.maxInclusive ?? baseMaxInclusive
    const effectiveTotalDigits = elementOverride?.totalDigits ?? baseTotalDigits
    const effectiveFractionDigits = elementOverride?.fractionDigits ?? baseFractionDigits
    const effectiveMinLength = elementOverride?.minLength ?? baseMinLength
    const effectiveMaxLength = elementOverride?.maxLength ?? baseMaxLength


    const minOccursWarning = baseMinOccurs != undefined && effectiveMinOccurs != undefined && effectiveMinOccurs < baseMinOccurs ? 'Lower than original' : undefined
    const maxOccursWarning = effectiveMinOccurs != undefined && effectiveMaxOccurs != undefined && effectiveMinOccurs > effectiveMaxOccurs ? 'Lower than minOccurs' : baseMaxOccurs != undefined && effectiveMaxOccurs != undefined && effectiveMaxOccurs > baseMaxOccurs ? 'Higher than original' : undefined
    const patternWarning = !isValidXsdPattern(elementOverride?.pattern ?? basePattern ?? '') ? 'Invalid XSD pattern' : undefined
    const minLengthWarning = baseMinLength != undefined && effectiveMinLength != undefined && effectiveMinLength < baseMinLength ? 'Lower than original' : undefined
    const maxLengthWarning = effectiveMinLength != undefined && effectiveMaxLength != undefined && effectiveMinLength > effectiveMaxLength ? 'Lower than minLength' : baseMaxLength != undefined && effectiveMaxLength != undefined && effectiveMaxLength > baseMaxLength ? 'Higher than original' : undefined
    const minInclusiveWarning = baseMinInclusive != undefined && effectiveMinInclusive != undefined && effectiveMinInclusive < baseMinInclusive ? 'Lower than original' : undefined
    const maxInclusiveWarning = effectiveMinInclusive != undefined && effectiveMaxInclusive != undefined && effectiveMinInclusive > effectiveMaxInclusive ? 'Lower than minInclusive' : baseMaxInclusive != undefined && effectiveMaxInclusive != undefined && effectiveMaxInclusive > baseMaxInclusive ? 'Higher than original' : undefined
    const totalDigitsWarning = baseTotalDigits != undefined && effectiveTotalDigits != undefined && effectiveTotalDigits < baseTotalDigits ? 'Lower than original' : undefined
    const fractionDigitsWarning = baseFractionDigits != undefined && effectiveFractionDigits != undefined && effectiveFractionDigits > baseFractionDigits ? 'Higher than original' : undefined

    function buildOverride(updates: Partial<ElementOverride>): ElementOverride {
        return {
            ...elementOverride,
            ...updates,
        } as ElementOverride
    }

    function saveOverride(updates: Partial<ElementOverride>) {
        const updated = buildOverride(updates)
        onUpdateOverride(xmlPath, updated)
    }

    function saveInt(field: string, original: number | undefined, val: string) {
        if (val === '') {
            saveOverride({[field]: undefined})
        } else {
            const num = parseInt(val, 10)
            if (!isNaN(num)) saveOverride({[field]: num === original ? undefined : num})
        }
    }

    function saveNumber(field: string, original: number | undefined, val: string) {
        if (val === '') {
            saveOverride({[field]: undefined})
        } else {
            const num = Number(val)
            if (!isNaN(num)) saveOverride({[field]: num === original ? undefined : num})
        }
    }

    const customPropNames = (customElementPropertyNames ?? []).filter(n => n.length > 0)

    function saveCustomProperty(name: string, val: string) {
        const newProps = {...(elementOverride?.customProperties ?? {})}
        if (!val.trim()) {
            delete newProps[name]
        } else {
            newProps[name] = val.trim()
        }
        const customProperties = Object.keys(newProps).length > 0 ? newProps : undefined
        saveOverride({customProperties})
    }

    const validateValue = createValueValidator(elementOverride, simpleType)

    return (
        <div className="detail-panel">
            <div>
                <div className="detail-label">{element.isAttribute ? 'XML Attribute' : 'XML Tag'}</div>
                <div style={{fontFamily: 'monospace'}}>{element.xmlTag}</div>
            </div>
            <div>
                <div className="detail-label">XML Path</div>
                <div style={{fontFamily: 'monospace'}}>{xmlPath}</div>
            </div>
            <div>
                <div className="detail-label">Type</div>
                <div>{dataType.name} {baseType && <span>({baseType})</span>}</div>
            </div>
            <div>
                <div className="detail-label">Definition</div>
                <EditableField
                    value={elementOverride?.definition ?? baseDefinition}
                    originalValue={baseDefinition}
                    inputType="textarea"
                    onSave={val => saveOverride({definition: val === (baseDefinition ?? '') ? undefined : val})}
                />
            </div>
            <div>
                <div className="detail-label">Min Occurs</div>
                <EditableField
                    value={effectiveMinOccurs?.toString()}
                    originalValue={baseMinOccurs?.toString()}
                    inputType="number"
                    warning={minOccursWarning}
                    onSave={val => saveInt('minOccurs', baseMinOccurs, val)}
                />
            </div>
            <div>
                <div className="detail-label">Max Occurs</div>
                <EditableField
                    value={effectiveMaxOccurs?.toString()}
                    originalValue={baseMaxOccurs?.toString()}
                    inputType="number"
                    warning={maxOccursWarning}
                    onSave={val => saveInt('maxOccurs', baseMaxOccurs, val)}
                />
            </div>
            {(baseType === 'Text' || baseType === 'CodeSet' || baseType === 'IdentifierSet' || baseType === 'Binary') && (<>
                <div>
                    <div className="detail-label">Min Length</div>
                    <EditableField
                        value={effectiveMinLength?.toString()}
                        originalValue={baseMinLength?.toString()}
                        inputType="number"
                        warning={minLengthWarning}
                        onSave={val => saveInt('minLength', baseMinLength, val)}
                    />
                </div>
                <div>
                    <div className="detail-label">Max Length</div>
                    <EditableField
                        value={effectiveMaxLength?.toString()}
                        originalValue={baseMaxLength?.toString()}
                        inputType="number"
                        warning={maxLengthWarning}
                        onSave={val => saveInt('maxLength', baseMaxLength, val)}
                    />
                </div>
            </>)}
            {(baseType === 'Year' || baseType === 'Amount' || baseType === 'Quantity' || baseType === 'Rate') && (<>
                <div>
                    <div className="detail-label">Min Inclusive</div>
                    <EditableField
                        value={effectiveMinInclusive?.toString()}
                        originalValue={baseMinInclusive?.toString()}
                        inputType="number"
                        warning={minInclusiveWarning}
                        onSave={val => saveNumber('minInclusive', baseMinInclusive, val)}
                    />
                </div>
                <div>
                    <div className="detail-label">Max Inclusive</div>
                    <EditableField
                        value={effectiveMaxInclusive?.toString()}
                        originalValue={baseMaxInclusive?.toString()}
                        inputType="number"
                        warning={maxInclusiveWarning}
                        onSave={val => saveNumber('maxInclusive', baseMaxInclusive, val)}
                    />
                </div>
            </>)}
            {(baseType === 'Amount' || baseType === 'Quantity' || baseType === 'Rate') && (<>
                <div>
                    <div className="detail-label">Total Digits</div>
                    <EditableField
                        value={effectiveTotalDigits?.toString()}
                        originalValue={baseTotalDigits?.toString()}
                        inputType="number"
                        warning={totalDigitsWarning}
                        onSave={val => saveInt('totalDigits', baseTotalDigits, val)}
                    />
                </div>
                <div>
                    <div className="detail-label">Fraction Digits</div>
                    <EditableField
                        value={effectiveFractionDigits?.toString()}
                        originalValue={baseFractionDigits?.toString()}
                        inputType="number"
                        warning={fractionDigitsWarning}
                        onSave={val => saveInt('fractionDigits', baseFractionDigits, val)}
                    />
                </div>
            </>)}
            {(baseType === 'Text' || baseType === 'CodeSet' || baseType === 'IdentifierSet' || baseType === 'DateTime' || baseType === 'Quantity') && (
                <div>
                    <div className="detail-label">Pattern</div>
                    <EditableField
                        value={elementOverride?.pattern ?? basePattern}
                        originalValue={basePattern}
                        warning={patternWarning}
                        onSave={val => {
                            saveOverride({pattern: val === (basePattern ?? '') ? undefined : val})
                        }}
                    />
                </div>
            )}
            {(baseType === 'Text' || baseType === 'CodeSet') && (
                <div>
                    <div className="detail-label">Allowed Values</div>
                    <EditableList
                        values={elementOverride?.allowedValues ?? baseAllowedValues}
                        originalValues={baseAllowedValues}
                        validateValue={v => validateValue(v)}
                        onSave={values => saveOverride({allowedValues: values.length === 0 ? undefined : values})}
                    />
                </div>
            )}
            {isSimpleType && (
                <div>
                    <div className="detail-label">Examples</div>
                    <EditableList
                        values={elementOverride?.examples ?? effectiveExamples}
                        originalValues={effectiveExamples}
                        validateValue={v => validateValue(v)}
                        onSave={values => saveOverride({examples: values.length === 0 ? undefined : values})}
                    />
                </div>
            )}
            {customPropNames.map(name => {
                const currentValue = elementOverride?.customProperties?.[name]
                const inheritedValue = inheritedOverride?.customProperties?.[name]
                const displayValue = currentValue || inheritedValue

                return (
                    <div key={name}>
                        <div className="detail-label">{splitCamelCase(name)}</div>
                        <EditableField
                            value={currentValue || displayValue}
                            originalValue={inheritedValue}
                            onSave={val => saveCustomProperty(name, val)}
                        />
                    </div>
                )
            })}
            <div>
                <button onClick={onAddConstraint}>+ Add constraint</button>
            </div>
        </div>
    )
}
