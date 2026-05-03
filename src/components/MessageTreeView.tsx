import {useMemo} from "react"
import type {Constraint, DataTypes, ElementOverrides, MessageDefinition, MessageElement} from "../types/types.ts"
import {MessageTreeContext} from "../contexts/MessageTreeContext.tsx"
import {ElementNode} from "./ElementNode.tsx"

export function MessageTreeView({
                                    message,
                                    dataTypes,
                                    elementOverrides = {},
                                    hideExcluded = false,
                                    showXmlTags,
                                    filter,
                                    selectedPath,
                                    onSelectElement,
                                    onSelectConstraint,
                                }: {
    message: MessageDefinition;
    dataTypes: DataTypes;
    elementOverrides?: ElementOverrides;
    hideExcluded?: boolean;
    showXmlTags: boolean;
    filter: string;
    selectedPath: string;
    onSelectElement: (element: MessageElement, xmlPath: string) => void;
    onSelectConstraint: (constraint: Constraint, path: string) => void;
}) {
    const filterActive = useMemo(() => !!filter, [filter])
    
    const visiblePaths = useMemo(() => {
        if (!filter) return new Set<string>()
        const paths = new Set<string>()
        const lowerFilter = filter.toLowerCase()

        function addAncestors(path: string) {
            const parts = path.split('/')
            for (let i = 1; i <= parts.length; i++) {
                paths.add(parts.slice(0, i).join('/'))
            }
        }

        function traverse(element: MessageElement, parentPath: string) {
            const elementPath = parentPath + '/' + element.xmlTag
            const name = showXmlTags ? element.xmlTag : element.name

            if (name.toLowerCase().includes(lowerFilter)) {
                addAncestors(elementPath)
            }

            const dataType = dataTypes[element.typeId]
            if (dataType) {
                for (const constraint of element.constraints) {
                    if (constraint.name.toLowerCase().includes(lowerFilter)) {
                        addAncestors(elementPath)
                        paths.add(elementPath + '/' + constraint.name)
                    }
                }
                for (const constraint of dataType.constraints) {
                    if (constraint.name.toLowerCase().includes(lowerFilter)) {
                        addAncestors(elementPath)
                        paths.add(elementPath + '/' + constraint.name)
                    }
                }
            }

            const complexType = dataType as { elements?: MessageElement[] }
            for (const child of complexType.elements ?? []) {
                traverse(child, elementPath)
            }

            const simpleType = dataType as { currencyIdentifierSet?: string | null }
            if (simpleType.currencyIdentifierSet) {
                const ccyPath = elementPath + '/Ccy'
                if ('Currency'.toLowerCase().includes(lowerFilter) || 'Ccy'.toLowerCase().includes(lowerFilter)) {
                    addAncestors(ccyPath)
                }
            }

            const override = elementOverrides[elementPath]
            if (override?.additionalConstraints) {
                for (const constraint of override.additionalConstraints) {
                    if (constraint.name.toLowerCase().includes(lowerFilter)) {
                        addAncestors(elementPath)
                        paths.add(elementPath + '/' + constraint.name)
                    }
                }
            }
        }

        traverse(message.rootElement, '')
        return paths
    }, [message.rootElement, dataTypes, elementOverrides, showXmlTags, filter])

    const contextValue = {
        dataTypes,
        overrides: elementOverrides,
        showXmlTags,
        selectedPath,
        hideExcluded,
        filterActive,
        visiblePaths,
        onSelectElement,
        onSelectConstraint,
    }

    const noMatches = filterActive && visiblePaths.size === 0

    return (
        <MessageTreeContext.Provider value={contextValue}>
            <div style={{flex: 3}}>
                {noMatches ? (
                    <div style={{padding: '1em', color: '#888', fontStyle: 'italic'}}>
                        No elements or constraints matching "{filter}"
                    </div>
                ) : (
                    <ElementNode element={message.rootElement} parentPath=""/>
                )}
            </div>
        </MessageTreeContext.Provider>
    )
}
