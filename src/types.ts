export interface MessageElement {
    id: string
    name: string
    xmlTag: string
    definition: string
    minOccurs: string
    maxOccurs: string
    typeId: string
}

export interface Code {
    codeName: string
    definition: string
}

export interface DataType {
    name: string
    definition: string
}

export interface Simpletype extends DataType {
    minInclusive: string | null
    maxInclusive: string | null
    totalDigits: string | null
    fractionDigits: string | null
    length: string | null
    minLength: string | null
    maxLength: string | null
    pattern: string | null
    baseValue: string | null
    codes: Code[]
}

export interface IndicatorType extends DataType {
    meaningWhenTrue: string | null
    meaningWhenFalse: string | null
}

export interface ComplexType extends DataType {
    isChoice: boolean
    elements: MessageElement[]
}

export interface MessageDefinition {
    name: string
    identifier: string
    shortCode: string
    definition: string
    xmlTag: string
    blocks: MessageElement[]
}

export interface BusinessArea {
    name: string
    code: string
    definition: string
    messages: MessageDefinition[]
}

export interface ERepository {
    dataTypes: Map<string, DataType>
    businessAreas: BusinessArea[]
}