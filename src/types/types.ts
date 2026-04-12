export interface Constraint {
    name: string
    definition: string
    expression: string | null
}

export interface MessageElement {
    id: string
    name: string
    xmlTag: string
    isAttribute: boolean
    definition: string
    minOccurs: number
    maxOccurs: number | null
    typeId: string
    constraints: Constraint[]
    examples: string[]
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

export interface SimpleType extends DataType {
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
    currencyIdentifierSet: string | null
    examples: string[]
}

export interface ComplexType extends DataType {
    isChoice: boolean
    elements: MessageElement[]
}

export interface MessageDefinition {
    name: string
    identifier: string
    shortCode: string
    rootElement: MessageElement
}

export interface BusinessArea {
    name: string
    code: string
    definition: string
    messages: MessageDefinition[]
}

export interface DataTypes {
    [id: string]: DataType
}

export interface ERepository {
    dataTypes: DataTypes
    businessAreas: BusinessArea[]
}

export interface ElementOverrides {
    [xmlPath: string]: ElementOverride
}

export interface ElementOverride {
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
    allowedValues: string[] | null
    examples: string[] | null
    additionalConstraints: Constraint[] | null
}

export interface MessageImplementationGuide {
    id: string
    name: string
    messageIdentifier: string
    parentMIG: string | null
    version: string
    description: string | null
    elementOverrides: ElementOverrides
}