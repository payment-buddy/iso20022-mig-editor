import type {Constraint, DataType, ElementOverride, MessageDefinition, MessageElement} from "../types/types.ts";
import {MessageTreeContext} from "../contexts/MessageTreeContext.tsx";
import {ElementNode} from "./ElementNode.tsx";
import {ConstraintNode} from "./ConstraintNode.tsx";

function indexOverrides(overrides: ElementOverride[]): Map<string, ElementOverride> {
    return new Map(overrides.map(o => [o.xmlPath, o]))
}

export function MessageTreeView({
                                    message,
                                    dataTypes,
                                    elementOverrides = [],
                                    hideExcluded = false,
                                    showXmlTags,
                                    selectedPath,
                                    onSelectElement,
                                    onSelectConstraint,
                                }: {
    message: MessageDefinition;
    dataTypes: Map<string, DataType>;
    elementOverrides?: ElementOverride[];
    hideExcluded?: boolean;
    showXmlTags: boolean;
    selectedPath: string;
    onSelectElement: (element: MessageElement, xmlPath: string) => void;
    onSelectConstraint: (constraint: Constraint, path: string) => void;
}) {
    const rootPath = '/' + message.xmlTag
    const overrides = indexOverrides(elementOverrides)
    const rootOverride = overrides.get(rootPath)
    const additionalConstraints = rootOverride?.additionalConstraints ?? []
    const constraints = [...message.constraints, ...additionalConstraints]

    const contextValue = {
        dataTypes,
        overrides,
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
                {constraints.map(c => (
                    <ConstraintNode key={c.name}
                                    constraint={c}
                                    parentPath={rootPath}/>
                ))}
            </div>
        </MessageTreeContext.Provider>
    )
}
