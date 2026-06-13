import type { ElementOverride, MessageElement } from "@/core/types/types"

/**
 * Build a validator for a string value (an allowed value or example) against the
 * element's **effective** length and pattern facets — the override value when
 * present (key-presence, honoring a tri-state `null` that removes the
 * constraint), otherwise the e-Repository baseline. Returns an error message, or
 * `null` when the value is acceptable. Advisory only.
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
    return null
  }
}
