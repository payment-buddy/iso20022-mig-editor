import type {ComplexType, DataType, MessageDefinition, MessageElement} from "./types.ts";

function collectTypeIds(elements: MessageElement[], dataTypes: Map<string, DataType>, collected: Set<string>) {
    for (const element of elements) {
        if (collected.has(element.typeId)) continue
        collected.add(element.typeId)
        const dataType = dataTypes.get(element.typeId) as ComplexType
        if (dataType?.elements?.length) {
            collectTypeIds(dataType.elements, dataTypes, collected)
        }
    }
}

function serializeElement(element: MessageElement, dataTypes: Map<string, DataType>): object {
    const dataType = dataTypes.get(element.typeId) as ComplexType
    const children = dataType?.elements
    const {id: _, typeId: __, ...rest} = element
    return {
        ...rest,
        type: dataType?.name,
        ...(dataType?.isChoice ? {isChoice: true} : {}),
        ...(children?.length ? {elements: children.map(child => serializeElement(child, dataTypes))} : {}),
    }
}

export function exportMessageDefinition(message: MessageDefinition, dataTypes: Map<string, DataType>) {
    const referencedTypeIds = new Set<string>()
    collectTypeIds(message.elements, dataTypes, referencedTypeIds)
    const referencedTypes = Object.fromEntries(
        [...referencedTypeIds].map(id => {
            const {name, elements: _, codes, ...rest} = dataTypes.get(id)! as ComplexType & {codes?: unknown[]}
            return [name, codes?.length ? {...rest, codes} : rest]
        })
    )
    const payload = JSON.stringify({
        ...message,
        elements: message.elements.map(el => serializeElement(el, dataTypes)),
        dataTypes: referencedTypes,
    }, null, 2)
    const blob = new Blob([payload], {type: 'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${message.identifier}.json`
    a.click()
    URL.revokeObjectURL(url)
}
