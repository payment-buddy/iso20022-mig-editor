// Canonical serialization order for MIG YAML export.
// Used by the export normalization; the data model itself lives in
// src/core/types/types.ts.

export const MIG_PROPERTY_ORDER = [
  "name",
  "version",
  "messageIdentifier",
  "parentMIG",
  "description",
  "elementAnnotationNames",
  "constraintAnnotationNames",
  "elementOverrides",
] as const

export const ELEMENT_OVERRIDE_PROPERTY_ORDER = [
  "definition",
  "minOccurs",
  "maxOccurs",
  "minInclusive",
  "maxInclusive",
  "totalDigits",
  "fractionDigits",
  "minLength",
  "maxLength",
  "pattern",
  "allowedValues",
  "examples",
  "annotations",
  "additionalConstraints",
  "constraintOverrides",
] as const

// Field order within each `additionalConstraints` entry (the name is the map key).
export const ADDITIONAL_CONSTRAINT_PROPERTY_ORDER = [
  "definition",
  "expression",
  "annotations",
] as const

export const CONSTRAINT_OVERRIDE_PROPERTY_ORDER = [
  "definition",
  "expression",
  "disabled",
] as const
