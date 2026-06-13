// Core data model for the ISO 20022 e-Repository

export interface Constraint {
  name: string
  definition: string
  customProperties?: Record<string, string | null>
}

export interface Code {
  codeName: string
  definition: string
}

export interface MessageElement {
  id: string
  name: string
  xmlTag: string
  isAttribute: boolean
  isChoice?: boolean
  definition: string
  minOccurs: number
  maxOccurs: number | null
  typeId: string
  type: string
  baseType: string | null
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
  constraints: Constraint[]
  examples: string[]
  elements: MessageElement[]
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
  businessAreas: BusinessArea[]
}
