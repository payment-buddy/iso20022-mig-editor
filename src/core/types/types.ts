// Core data model for the ISO 20022 e-Repository

export interface Constraint {
  name: string
  definition: string
  /** Optional formal rule expression (MIG-added constraints; absent on parsed ones). */
  expression?: string
  annotations?: Record<string, string | null>
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

// --- Message Implementation Guide (MIG) ---
// A MIG is a named, versioned overlay on one message definition. Constraint
// fields are tri-state (FUNCTIONALITY.md §10 /
// MIG_FORMAT.md): absent = inherit, `null` = remove the constraint, value = set.
// These are plain interfaces today; a Zod validator is added at the import
// boundary in Phase 3 (see IMPLEMENTATION_PLAN.md §0/§1.1). Additional
// constraints reuse the e-Repository `Constraint` shape above.

export interface ElementOverride {
  definition?: string | null
  minOccurs?: number | null
  maxOccurs?: number | null
  minInclusive?: number | null
  maxInclusive?: number | null
  totalDigits?: number | null
  fractionDigits?: number | null
  minLength?: number | null
  maxLength?: number | null
  pattern?: string | null
  allowedValues?: string[]
  examples?: string[]
  annotations?: Record<string, string>
  additionalConstraints?: Constraint[]
  /** Overlays on standard/inherited constraints, keyed by constraint name. */
  constraintOverrides?: Record<string, ConstraintOverride>
}

/**
 * MIG overlay on a standard (ISO) or inherited constraint, keyed by name in
 * `ElementOverride.constraintOverrides`. Tri-state per field (absent = inherit,
 * `null` = clear, value = set).
 */
export interface ConstraintOverride {
  definition?: string | null
  expression?: string | null
  /** Switch the rule off (presence = set; absent inherits; a child can re-enable with `false`). */
  disabled?: boolean
}

/** Map of `xmlPath` → override. */
export interface ElementOverrides {
  [xmlPath: string]: ElementOverride
}

/** Identity key is `name:version`. */
export interface MessageImplementationGuide {
  name: string
  messageIdentifier: string
  parentMIG?: string
  version: string
  description?: string
  elementAnnotationNames?: string[]
  constraintAnnotationNames?: string[]
  elementOverrides: ElementOverrides
}
