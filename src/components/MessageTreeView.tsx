import type {Constraint, DataTypes, ElementOverrides, MessageDefinition, MessageElement} from "../types/types.ts"
import {MessageTreeContext} from "../contexts/MessageTreeContext.tsx"
import {ElementNode} from "./ElementNode.tsx"
import {ConstraintNode} from "./ConstraintNode.tsx"

export function MessageTreeView({
                                    message,
                                    dataTypes,
                                    elementOverrides = {},
                                    hideExcluded = false,
                                    showXmlTags,
                                    selectedPath,
                                    onSelectElement,
                                    onSelectConstraint,
                                }: {
    message: MessageDefinition;
    dataTypes: DataTypes;
    elementOverrides?: ElementOverrides;
    hideExcluded?: boolean;
    showXmlTags: boolean;
    selectedPath: string;
    onSelectElement: (element: MessageElement, xmlPath: string) => void;
    onSelectConstraint: (constraint: Constraint, path: string) => void;
}) {
    const rootPath = '/' + message.xmlTag
    const rootOverride = elementOverrides[rootPath]
    const additionalConstraints = rootOverride?.additionalConstraints ?? []

    const contextValue = {
        dataTypes,
        overrides: elementOverrides,
        showXmlTags,
        selectedPath,
        hideExcluded,
        onSelectElement,
        onSelectConstraint,
    }

    return (
        <MessageTreeContext.Provider value={contextValue}>
            <div style={{flex: 3}}>
                <div>{showXmlTags ? message.xmlTag : message.name}</div>
                {message.elements.map(element => (
                    <ElementNode key={element.xmlTag}
                                 element={element}
                                 parentPath={rootPath}/>
                ))}
                {message.constraints.map(c => (
                    <ConstraintNode key={c.name}
                                    constraint={c}
                                    parentPath={rootPath}/>
                ))}
                {additionalConstraints.map(c => (
                    <ConstraintNode key={c.name}
                                    constraint={c}
                                    parentPath={rootPath}
                                    isAdditional={true}/>
                ))}
            </div>
        </MessageTreeContext.Provider>
    )
}
