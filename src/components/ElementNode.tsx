import {useEffect, useState} from "react"
import type {ComplexType, ElementOverride, MessageElement, SimpleType} from "../types/types.ts"
import {useMessageTreeContext} from "../contexts/MessageTreeContext.tsx"
import {ConstraintNode} from "./ConstraintNode.tsx"

function Cardinality({element, override}: { element: MessageElement, override: ElementOverride | undefined }) {
    const min = override?.minOccurs ?? element.minOccurs
    const max = override?.maxOccurs ?? element.maxOccurs
    return (
        <span style={{color: '#888', marginLeft: '0.4em'}}>
            [{min}..{max ?? '*'}]
        </span>
    )
}

export function ElementNode({element, parentPath}: {
    element: MessageElement
    parentPath: string
}) {
    const {
        dataTypes,
        overrides,
        showXmlTags,
        selectedPath,
        hideExcluded,
        filterActive,
        visiblePaths,
        onSelectElement
    } = useMessageTreeContext()
    const [open, setOpen] = useState(!parentPath)
    const elementPath = parentPath + '/' + element.xmlTag

    useEffect(() => {
        if (visiblePaths.size > 0 && visiblePaths.has(elementPath)) {
            setOpen(true)
        }
    }, [visiblePaths, elementPath])
    const isSelected = elementPath === selectedPath
    const dataType = dataTypes[element.typeId]!
    const complexType = dataType as ComplexType
    const simpleType = dataType as SimpleType
    const ccyElement: MessageElement | null = simpleType.currencyIdentifierSet
        ? {
            id: element.id + '/Ccy',
            name: 'Currency',
            xmlTag: 'Ccy',
            isAttribute: true,
            definition: '',
            minOccurs: 1,
            maxOccurs: 1,
            typeId: simpleType.currencyIdentifierSet,
            constraints: [],
            examples: [],
        }
        : null
    const override = overrides[elementPath]
    const hasChildren = complexType.elements?.length || element.constraints?.length || dataType.constraints?.length || override?.additionalConstraints?.length
    const isExcluded = (override?.maxOccurs ?? element.maxOccurs) === 0

    if (isExcluded && hideExcluded) return null

    if (filterActive && !visiblePaths.has(elementPath)) return null

    if (!hasChildren) {
        return (
            <>
                <div className={'tree-node' + (isSelected ? ' is-selected' : '')}
                     onClick={() => onSelectElement(element, elementPath)}>
                    <span style={{marginRight: '0.5em', fontSize: '0.7em'}}>◇</span>
                    <span className={(override ? 'has-override' : '') + (isExcluded ? ' is-excluded' : '')}>{showXmlTags ? element.xmlTag : element.name}</span>
                    <Cardinality element={element} override={override}/>
                </div>
            </>
        )
    }

    return (
        <div>
            <div className={'tree-node' + (isSelected ? ' is-selected' : '')} onClick={() => {
                onSelectElement(element, elementPath)
                if (elementPath === selectedPath || !open) {
                    setOpen(o => !o)
                }
            }}>
                <span style={{marginLeft: '0', marginRight: '0.4em', fontSize: '0.7em'}}>{open ? '▼' : '▶'}</span>
                <span className={(override ? 'has-override' : '') + (isExcluded ? ' is-excluded' : '')}>{showXmlTags ? element.xmlTag : element.name}</span>
                <Cardinality element={element} override={override}/>
                {complexType.isChoice && <span className="badge">choice</span>}
            </div>
            {open && <div style={{marginLeft: '1em'}}>
                {complexType.elements?.map(child => (
                    <ElementNode key={child.xmlTag}
                                 element={child}
                                 parentPath={elementPath}/>
                ))}
                {ccyElement && (
                    <ElementNode key="Ccy"
                                 element={ccyElement}
                                 parentPath={elementPath}/>
                )}
                {element.constraints.map((constraint) => (
                    <ConstraintNode key={constraint.name}
                                    constraint={constraint}
                                    parentPath={elementPath}/>
                ))}
                {dataType?.constraints.map((constraint) => (
                    <ConstraintNode key={constraint.name}
                                    constraint={constraint}
                                    parentPath={elementPath}/>
                ))}
                {override?.additionalConstraints?.map((constraint) => (
                    <ConstraintNode key={constraint.name}
                                    constraint={constraint}
                                    parentPath={elementPath}
                                    isAdditional={true}/>
                ))}
            </div>}
        </div>
    )
}
