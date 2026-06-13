// Canonical serialization order for MIG YAML export (ported from legacy).
// Used by the export normalization in Phase 5; the data model itself lives in
// src/core/types/types.ts.

export const MIG_PROPERTY_ORDER = [
  "name",
  "messageIdentifier",
  "parentMIG",
  "version",
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
] as const

export const CONSTRAINT_PROPERTY_ORDER = ["name", "definition", "annotations"] as const
