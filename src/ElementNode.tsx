import {useState} from "react";
import type {ComplexType, Constraint, DataType, ElementOverride, MessageElement, Simpletype} from "./types.ts";
import {ConstraintNode} from "./ConstraintNode.tsx";

function Cardinality({element, override}: { element: MessageElement, override: ElementOverride | undefined }) {
    const min = override?.minOccurs ?? element.minOccurs
    const max = override?.maxOccurs ?? element.maxOccurs
    return (
        <span style={{color: '#888', marginLeft: '0.4em'}}>
            [{min}..{max}]
        </span>
    )
}

export function ElementNode({
                                element,
                                dataTypes,
                                showXmlTags,
                                parentPath,
                                selectedPath,
                                elementOverrides = [],
                                hideExcluded = false,
                                onSelectElement,
                                onSelectConstraint
                            }: {
    element: MessageElement
    dataTypes: Map<string, DataType>
    showXmlTags: boolean
    parentPath: string
    selectedPath: string
    elementOverrides?: ElementOverride[]
    hideExcluded?: boolean
    onSelectElement: (elem: MessageElement, path: string) => void
    onSelectConstraint: (constraint: Constraint, path: string) => void
}) {
    const [open, setOpen] = useState(false)
    const elementPath = parentPath + '/' + element.xmlTag
    const isSelected = elementPath === selectedPath;
    const background = isSelected ? '#2b5ce6' : 'transparent'
    const color = isSelected ? '#fff' : undefined
    const dataType = dataTypes.get(element.typeId)!
    const complexType = dataType as ComplexType
    const simpleType = dataType as Simpletype
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
            constraints: []
        }
        : null
    const override = elementOverrides.find(o => o.xmlPath === elementPath)
    const hasChildren = complexType.elements?.length || element.constraints?.length || dataType.constraints?.length || override?.additionalConstraints?.length
    const isExcluded = (override?.maxOccurs ?? element.maxOccurs) === 0
    const nameStyle = isExcluded ? {textDecoration: 'line-through' as const} : undefined

    if (isExcluded && hideExcluded) return null

    if (!hasChildren) {
        return (
            <>
                <div style={{marginLeft: '1em', cursor: 'pointer', background, color}}
                     onClick={() => onSelectElement(element, elementPath)}>
                    <span style={{marginRight: '0.5em', fontSize: '0.7em'}}>◇</span>
                    <span style={nameStyle}>{showXmlTags ? element.xmlTag : element.name}</span>
                    <Cardinality element={element} override={override}/>
                </div>
            </>
        )
    }

    return (
        <div style={{marginLeft: '1em'}}>
            <div style={{cursor: 'pointer', background, color}} onClick={() => {
                onSelectElement(element, elementPath)
                if (elementPath === selectedPath || !open) {
                    setOpen(o => !o)
                }
            }}>
                <span style={{marginLeft: '0', marginRight: '0.4em', fontSize: '0.7em'}}>{open ? '▼' : '▶'}</span>
                <span style={nameStyle}>{showXmlTags ? element.xmlTag : element.name}</span>
                <Cardinality element={element} override={override}/>
                {complexType.isChoice && <span className="badge">choice</span>}
            </div>
            {open && <>
                {complexType.elements?.map(child => (
                    <ElementNode key={child.xmlTag}
                                 element={child}
                                 dataTypes={dataTypes}
                                 showXmlTags={showXmlTags}
                                 parentPath={elementPath}
                                 selectedPath={selectedPath}
                                 elementOverrides={elementOverrides}
                                 hideExcluded={hideExcluded}
                                 onSelectElement={onSelectElement}
                                 onSelectConstraint={onSelectConstraint}/>
                ))}
                {ccyElement && (
                    <ElementNode key="Ccy"
                                 element={ccyElement}
                                 dataTypes={dataTypes}
                                 showXmlTags={showXmlTags}
                                 parentPath={elementPath}
                                 selectedPath={selectedPath}
                                 elementOverrides={elementOverrides}
                                 hideExcluded={hideExcluded}
                                 onSelectElement={onSelectElement}
                                 onSelectConstraint={onSelectConstraint}/>
                )}
                {element.constraints.map((constraint) => (
                    <ConstraintNode key={constraint.name}
                                    constraint={constraint}
                                    parentPath={elementPath}
                                    selectedPath={selectedPath}
                                    onSelect={onSelectConstraint}/>
                ))}
                {dataType.constraints.map((constraint) => (
                    <ConstraintNode key={constraint.name}
                                    constraint={constraint}
                                    parentPath={elementPath}
                                    selectedPath={selectedPath}
                                    onSelect={onSelectConstraint}/>
                ))}
                {override?.additionalConstraints?.map((constraint) => (
                    <ConstraintNode key={constraint.name}
                                    constraint={constraint}
                                    parentPath={elementPath}
                                    selectedPath={selectedPath}
                                    onSelect={onSelectConstraint}/>
                ))}
            </>}
        </div>
    )
}
