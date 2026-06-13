import type { ElementOverride, MessageElement } from "@/core/types/types"

/**
 * Significant total/fraction digit counts of a decimal string (XSD-style: leading
 * integer zeros and trailing fraction zeros don't count), or `null` if the value
 * isn't a plain decimal — in which case the digit facets simply don't apply.
 */
function digitCounts(value: string): { total: number; fraction: number } | null {
  const m = /^[+-]?(\d*)(?:\.(\d*))?$/.exec(value.trim())
  if (!m || (m[1] === "" && (m[2] ?? "") === "")) return null
  const intDigits = (m[1] ?? "").replace(/^0+/, "")
  const fracDigits = (m[2] ?? "").replace(/0+$/, "")
  return { total: intDigits.length + fracDigits.length, fraction: fracDigits.length }
}

const plural = (n: number) => (n === 1 ? "" : "s")

/**
 * Build a validator for a string value (an allowed value or example) against the
 * element's **effective** length, pattern and total/fraction-digit facets — the
 * override value when present (key-presence, honoring a tri-state `null` that
 * removes the constraint), otherwise the e-Repository baseline. Digit facets only
 * apply when the value parses as a decimal. Returns an error message, or `null`
 * when the value is acceptable. Advisory only.
 */
export function createValueValidator(
  element: MessageElement,
  override: ElementOverride | undefined,
): (value: string) => string | null {
  const has = (field: keyof ElementOverride) => override !== undefined && field in override

  // An exact `length` acts as both min and max when the dedicated facets are unset.
  const minLength = has("minLength") ? override!.minLength : (element.minLength ?? element.length)
  const maxLength = has("maxLength") ? override!.maxLength : (element.maxLength ?? element.length)
  const pattern = has("pattern") ? override!.pattern : element.pattern
  const totalDigits = has("totalDigits") ? override!.totalDigits : element.totalDigits
  const fractionDigits = has("fractionDigits") ? override!.fractionDigits : element.fractionDigits

  return (value: string): string | null => {
    if (minLength != null && value.length < minLength) return `Shorter than min length ${minLength}`
    if (maxLength != null && value.length > maxLength) return `Longer than max length ${maxLength}`
    if (pattern != null && pattern !== "") {
      try {
        if (!new RegExp(`^(?:${pattern})$`).test(value)) return `Does not match pattern ${pattern}`
      } catch {
        return null // Unparseable pattern — can't validate, so don't flag.
      }
    }
    if (totalDigits != null || fractionDigits != null) {
      const counts = digitCounts(value)
      if (counts) {
        if (fractionDigits != null && counts.fraction > fractionDigits) {
          return `More than ${fractionDigits} fraction digit${plural(fractionDigits)}`
        }
        if (totalDigits != null && counts.total > totalDigits) {
          return `More than ${totalDigits} total digit${plural(totalDigits)}`
        }
      }
    }
    return null
  }
}

/** Which direction loosens a numeric facet: a `min` dropped, or a `max` raised. */
export type FacetDirection = "min" | "max"

/**
 * Advisory warning when a numeric facet override loosens its baseline (the
 * inherited/original limit): a `min` facet below it, or a `max` facet above it
 * (FUNCTIONALITY §5.7). `null` within the baseline, or when either side is
 * unconstrained (raising or adding a limit only tightens).
 */
export function looseningWarning(
  label: string,
  baseline: number | null,
  value: number | null,
  dir: FacetDirection,
): string | null {
  if (baseline === null || value === null) return null
  if (dir === "min" ? value < baseline : value > baseline) {
    return `Looser than the original: ${label} ${value} is ${dir === "min" ? "below" : "above"} ${baseline}.`
  }
  return null
}

/** Warning when a `max` is below the `min` of the same facet (an empty range). */
export function rangeWarning(
  label: string,
  min: number | null,
  max: number | null,
): string | null {
  if (min === null || max === null || max >= min) return null
  return `${label}: max ${max} is below min ${min}.`
}

/** Warning when a pattern override isn't a valid regular expression (FUNCTIONALITY §5.7). */
export function patternWarning(pattern: string | null): string | null {
  if (pattern == null || pattern === "") return null
  try {
    new RegExp(`^(?:${pattern})$`)
    return null
  } catch {
    return "Invalid pattern — not a valid regular expression."
  }
}
