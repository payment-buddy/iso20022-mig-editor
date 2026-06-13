// Core data model for the ISO 20022 e-Repository

import type { RepoCodeSet } from "@/core/mig/expression/codeListResolver"

export interface Constraint {
  name: string
  definition: string
  /**
   * Formal rule expression in this app's path DSL. For a standard (ISO)
   * constraint it is *derived* from `isoExpression` at message-resolve time (see
   * `enrichMessageDsl`) and is absent when the ISO rule can't be transpiled; for
   * a MIG-added constraint it is authored directly. Consumed by
   * `validateInstance` and emitted in the message/MIG YAML.
   */
  expression?: string
  /**
   * The raw ISO 20022 `RuleDefinition` XML blob as parsed from the repository
   * (the standard's `expression` attribute). Kept verbatim — the DSL `expression`
   * above is computed from it. Absent on MIG-added constraints.
   */
  isoExpression?: string
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

/**
 * An ISO 20022 MessageSet: a curated, cross-area collection of message
 * definitions grouped for a business purpose. Members are referenced by their
 * identifier (e.g. `pacs.008.001.08`) — not embedded — to keep the stored
 * repository compact.
 */
export interface MessageSet {
  name: string
  definition: string
  messageIdentifiers: string[]
}

export interface DataTypes {
  [id: string]: DataType
}

export interface ERepository {
  businessAreas: BusinessArea[]
  /** Curated cross-area message collections (ISO `MessageSet`s). */
  messageSets?: MessageSet[]
  /**
   * All ISO `CodeSet`s, indexed for the `WithInList`/`NotWithInList` resolver
   * used when transpiling constraint expressions (`buildCodeListResolver`). The
   * in-app `Code`/`SimpleType` model drops the `name`/`trace` these need, so they
   * are captured separately at parse time.
   */
  codeSets?: RepoCodeSet[]
}

// --- Message Implementation Guide (MIG) ---
// A MIG is a named, versioned overlay on one message definition. Constraint
// fields are tri-state: absent = inherit, `null` = remove the constraint, value = set.
// These are plain interfaces today; a Zod validator is added at the import
// boundary. Additional
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
  /** MIG-added constraints, keyed by constraint name (the name is the key). */
  additionalConstraints?: Record<string, AdditionalConstraint>
  /** Overlays on standard/inherited constraints, keyed by constraint name. */
  constraintOverrides?: Record<string, ConstraintOverride>
}

/**
 * A MIG-added constraint, keyed by name in `ElementOverride.additionalConstraints`.
 * The name lives in the map key (mirroring `constraintOverrides`); this is the
 * authored subset of `Constraint` — no `isoExpression` (that's ISO-derived only).
 */
export interface AdditionalConstraint {
  definition: string
  /** Optional formal rule expression in this app's path DSL (omitted when empty). */
  expression?: string
  annotations?: Record<string, string | null>
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
  /**
   * Per-name annotation overlay on a standard (ISO) or inherited constraint —
   * tri-state per name (absent = inherit, `null` = clear, value = set). Lets a MIG
   * override one inherited constraint annotation without re-owning the whole
   * constraint. `AdditionalConstraint.annotations` carries the values for the
   * MIG's *own* added constraints; this carries the overlay on everything else.
   */
  annotations?: Record<string, string | null>
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
