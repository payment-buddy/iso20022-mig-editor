import type { ElementOverride, MessageElement } from "@/core/types/types"

// Baseline derivation shared by the MIG editor's per-field reset/normalize logic
// (the `commit*` handlers in `features/mig/MigElementDetail.tsx`) and the
// import-time `normalizeMig`. The baseline a field "resets to" is the value the
// **parent-MIG chain** sets for it (key-presence, never `??`, so a stored `null`
// counts as set), falling back to the **ISO standard** carried by the message
// element. Keeping this in one place stops the editor and the importer drifting.

/** Shallow, order-sensitive equality of two string lists. */
export function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/** Numeric facets whose baseline is a `number | null`. */
export const NUMERIC_FACETS = new Set<keyof ElementOverride>([
  "minOccurs",
  "maxOccurs",
  "minInclusive",
  "maxInclusive",
  "totalDigits",
  "fractionDigits",
  "minLength",
  "maxLength",
])

/** ISO-standard source for a numeric facet (length facets fall back to `length`). */
function isoNumeric(
  field: keyof ElementOverride,
  element: MessageElement
): number | null {
  switch (field) {
    case "minOccurs":
      return element.minOccurs
    case "maxOccurs":
      return element.maxOccurs
    case "minInclusive":
      return element.minInclusive
    case "maxInclusive":
      return element.maxInclusive
    case "totalDigits":
      return element.totalDigits
    case "fractionDigits":
      return element.fractionDigits
    case "minLength":
      return element.minLength ?? element.length
    case "maxLength":
      return element.maxLength ?? element.length
    default:
      return null
  }
}

/**
 * The baseline value for a scalar/list override field — the inherited value if
 * the parent chain sets one, else the ISO standard. Defined for the numeric
 * facets plus `definition`, `pattern`, `allowedValues`, and `examples`; the
 * composite fields (`annotations`, `additionalConstraints`, `constraintOverrides`)
 * have no single baseline and return `undefined`.
 */
export function fieldBaseline(
  field: keyof ElementOverride,
  element: MessageElement,
  inherited: ElementOverride | undefined
): number | string | null | string[] | undefined {
  const inh = inherited !== undefined && field in inherited
  switch (field) {
    case "definition":
      return inh ? (inherited?.definition ?? "") : element.definition
    case "pattern":
      return inh ? (inherited?.pattern ?? null) : element.pattern
    case "allowedValues":
      return inh
        ? (inherited?.allowedValues ?? [])
        : element.codes.map((c) => c.codeName)
    case "examples":
      return inh ? (inherited?.examples ?? []) : element.examples
    default:
      if (NUMERIC_FACETS.has(field)) {
        const v = inherited?.[field]
        return inh && (typeof v === "number" || v === null)
          ? v
          : isoNumeric(field, element)
      }
      return undefined
  }
}
