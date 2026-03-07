import type {MessageElement} from "./types.ts";

export function ElementDetail({element}: { element: MessageElement }) {
    return (
        <dl>
            <dt>Type</dt>
            <dd>{element.typeId}</dd>
            <dt>Multiplicity</dt>
            <dd>[{element.minOccurs}..{element.maxOccurs}]</dd>
            <dt>XML Tag</dt>
            <dd>{element.xmlTag}</dd>
            <dt>Description</dt>
            <dd>{element.definition}</dd>
        </dl>
    )
}