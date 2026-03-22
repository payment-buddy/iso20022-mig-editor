import type {DataType, ElementOverride, MessageElement, Simpletype} from "./types.ts";
import {EditableText} from "./EditableText.tsx";
import {EditableNumber} from "./EditableNumber.tsx";

export function ElementDetailEdit({element, dataType, xmlPath, elementOverride, onUpdateOverride}: {
    element: MessageElement
    dataType: DataType
    xmlPath: string
    elementOverride: ElementOverride | null
    onUpdateOverride: (override: ElementOverride) => void
}) {
    const isTextType = 'baseType' in dataType && (dataType as Simpletype).baseType === 'Text'
    const simpleType = dataType as Simpletype

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
            codes: [],
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
                    onSave={val => saveInt('minOccurs', element.minOccurs, val)}
                />
            </div>
            <div>
                <div className="detail-label">Max Occurs</div>
                <EditableNumber
                    value={elementOverride?.maxOccurs ?? element.maxOccurs}
                    originalValue={element.maxOccurs}
                    onSave={val => saveInt('maxOccurs', element.maxOccurs, val)}
                />
            </div>
            {isTextType && (<>
                <div>
                    <div className="detail-label">Min Length</div>
                    <EditableNumber
                        value={elementOverride?.minLength ?? simpleType.minLength ?? simpleType.length}
                        originalValue={simpleType.minLength ?? simpleType.length}
                        onSave={val => saveInt('minLength', simpleType.minLength, val)}
                    />
                </div>
                <div>
                    <div className="detail-label">Max Length</div>
                    <EditableNumber
                        value={elementOverride?.maxLength ?? simpleType.maxLength ?? simpleType.length}
                        originalValue={simpleType.maxLength ?? simpleType.length}
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
        </div>
    )
}
