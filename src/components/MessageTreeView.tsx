import type {Constraint, DataTypes, ElementOverrides, MessageDefinition, MessageElement} from "../types/types.ts"
import {MessageTreeContext} from "../contexts/MessageTreeContext.tsx"
import {ElementNode} from "./ElementNode.tsx"

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
                <ElementNode element={message.rootElement} parentPath=""/>
            </div>
        </MessageTreeContext.Provider>
    )
}
