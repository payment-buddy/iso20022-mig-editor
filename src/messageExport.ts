import type {ComplexType, DataType, MessageDefinition, MessageElement} from "./types.ts";
import {stringify} from "yaml";

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
    const isComplex = !!children
    const {id: _, typeId: __, ...rest} = element
    return {
        ...rest,
        ...(!isComplex ? {type: dataType?.name} : {}),
        ...(dataType?.isChoice ? {isChoice: true} : {}),
        ...(children?.length ? {elements: children.map(child => serializeElement(child, dataTypes))} : {}),
    }
}

export function exportMessageDefinition(message: MessageDefinition, dataTypes: Map<string, DataType>) {
    const referencedTypeIds = new Set<string>()
    collectTypeIds(message.elements, dataTypes, referencedTypeIds)
    const referencedTypes = Object.fromEntries(
        [...referencedTypeIds].flatMap(id => {
            const {name, elements, codes, ...rest} = dataTypes.get(id)! as ComplexType & {codes?: unknown[]}
            if (elements) return []
            return [[name, codes?.length ? {...rest, codes} : rest]]
        })
    )
    const payload = stringify({
        ...message,
        elements: message.elements.map(el => serializeElement(el, dataTypes)),
        dataTypes: referencedTypes,
    })
    const blob = new Blob([payload], {type: 'text/yaml'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${message.identifier}.yaml`
    a.click()
    URL.revokeObjectURL(url)
}
