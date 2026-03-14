export interface Constraint {
    name: string
    definition: string
    expression: string
}

export interface MessageElement {
    id: string
    name: string
    xmlTag: string
    definition: string
    minOccurs: number
    maxOccurs: number
    typeId: string
    constraints: Constraint[]
}

export interface Code {
    codeName: string
    definition: string
}

export interface DataType {
    name: string
    definition: string
    constraints: Constraint[]
}

export interface Simpletype extends DataType {
    baseType: string
    minInclusive: number | null
    maxInclusive: number | null
    totalDigits: number | null
    fractionDigits: number | null
    length: number | null
    minLength: number | null
    maxLength: number | null
    pattern: string | null
    baseValue: string | null
    codes: Code[]
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
    elements: MessageElement[]
    constraints: Constraint[]
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

export interface ElementOverride {
    xmlPath: string
    definition: string | null
    minOccurs: number | null
    maxOccurs: number | null
    minInclusive: number | null
    maxInclusive: number | null
    totalDigits: number | null
    fractionDigits: number | null
    minLength: number | null
    maxLength: number | null
    pattern: string | null
    codes: Code[]
    additionalConstraints: Constraint[]
}

export interface MessageImplementationGuide {
    id: string
    messageIdentifier: string
    name: string
    version: string
    description: string | null
    elementOverrides: ElementOverride[]
    additionalConstraints: Constraint[]
}