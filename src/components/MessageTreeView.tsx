import type {Constraint, DataType, ElementOverride, MessageDefinition, MessageElement} from "../types/types.ts";
import {ElementNode} from "./ElementNode.tsx";
import {ConstraintNode} from "./ConstraintNode.tsx";

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
    const elementOverride = elementOverrides.find(o => o.xmlPath === '/' + message.xmlTag);
    const additionalConstraints = elementOverride?.additionalConstraints ?? [];

    return (
        <div style={{flex: 3}}>
            <div>{showXmlTags ? message.xmlTag : message.name}</div>
            {message.elements.map(element => (
                <ElementNode key={element.xmlTag}
                             element={element}
                             dataTypes={dataTypes}
                             showXmlTags={showXmlTags}
                             parentPath={'/' + message.xmlTag}
                             selectedPath={selectedPath}
                             elementOverrides={elementOverrides}
                             hideExcluded={hideExcluded}
                             onSelectElement={onSelectElement}
                             onSelectConstraint={onSelectConstraint}/>
            ))}
            {message.constraints.map(c => (
                <ConstraintNode key={c.name}
                                constraint={c}
                                parentPath={'/' + message.xmlTag}
                                selectedPath={selectedPath}
                                onSelect={onSelectConstraint}/>
            ))}
            {additionalConstraints.map(c => (
                <ConstraintNode key={c.name}
                                constraint={c}
                                parentPath={'/' + message.xmlTag}
                                selectedPath={selectedPath}
                                onSelect={onSelectConstraint}/>
            ))}
        </div>
    )
}
