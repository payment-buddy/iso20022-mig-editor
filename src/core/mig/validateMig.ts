// Consolidated MIG consistency check. A MIG should only *tighten* the message; this flags where it loosens
// or is internally inconsistent, across every path it overrides — the same
// per-field rules the editor shows, aggregated for the diagnostics drawer.
// Advisory only (all warnings). Pure.

import { looseningWarning, patternWarning } from "./fieldValidation"
import { isExternalCodeSet } from "@/core/erepository/codeSet"
import { elementAtPath } from "@/core/erepository/elementPath"
import type {
  ElementOverride,
  ElementOverrides,
  MessageDefinition,
  MessageElement,
  MessageImplementationGuide,
} from "@/core/types/types"

/**
 * `loosening` — the MIG relaxes the message (a dropped restriction); often
 * intentional, so it's advisory and kept out of the editor's "issues" banner.
 * `consistency` — an internal contradiction (empty range, invalid pattern,
 * values outside the standard set); a genuine problem.
 */
export type DiagnosticKind = "loosening" | "consistency"

export type Diagnostic = {
  path: string
  elementName: string
  /** Field label, e.g. "Max length". */
  field: string
  message: string
  kind: DiagnosticKind
}

/** Per-field diagnostics for one element vs its inherited/ISO baseline. */
function elementDiagnostics(
  element: MessageElement,
  inherited: ElementOverride | undefined,
  own: ElementOverride
): { field: string; message: string; kind: DiagnosticKind }[] {
  const out: { field: string; message: string; kind: DiagnosticKind }[] = []
  const inh = (f: keyof ElementOverride) =>
    inherited !== undefined && f in inherited
  const ownHas = (f: keyof ElementOverride) => f in own
  const add = (field: string, message: string | null, kind: DiagnosticKind) => {
    if (message) out.push({ field, message, kind })
  }
  // Effective value (own → inherited → ISO) and the baseline it loosens against.
  const numAt = (f: keyof ElementOverride, iso: number | null) => {
    const baseline = inh(f) ? (inherited![f] as number | null) : iso
    const effective = ownHas(f) ? (own[f] as number | null) : baseline
    return { baseline, effective }
  }

  const minOccurs = numAt("minOccurs", element.minOccurs)
  const maxOccurs = numAt("maxOccurs", element.maxOccurs)
  const minLength = numAt("minLength", element.minLength ?? element.length)
  const maxLength = numAt("maxLength", element.maxLength ?? element.length)
  const minInclusive = numAt("minInclusive", element.minInclusive)
  const maxInclusive = numAt("maxInclusive", element.maxInclusive)
  const totalDigits = numAt("totalDigits", element.totalDigits)
  const fractionDigits = numAt("fractionDigits", element.fractionDigits)

  // Min facets loosen when lowered below the baseline.
  if (ownHas("minOccurs"))
    add(
      "Min occurs",
      looseningWarning(
        "min occurs",
        minOccurs.baseline,
        minOccurs.effective,
        "min"
      ),
      "loosening"
    )
  if (ownHas("minLength"))
    add(
      "Min length",
      looseningWarning(
        "min length",
        minLength.baseline,
        minLength.effective,
        "min"
      ),
      "loosening"
    )
  if (ownHas("minInclusive"))
    add(
      "Min inclusive",
      looseningWarning(
        "min inclusive",
        minInclusive.baseline,
        minInclusive.effective,
        "min"
      ),
      "loosening"
    )

  // Max facets: an empty range (max below min) when this MIG touches either side,
  // otherwise loosening when the max is raised.
  type Num = { baseline: number | null; effective: number | null }
  const maxPair = (
    maxField: keyof ElementOverride,
    minField: keyof ElementOverride,
    label: string,
    rangeLabel: string,
    max: Num,
    min: Num
  ) => {
    if (
      (ownHas(maxField) || ownHas(minField)) &&
      max.effective !== null &&
      min.effective !== null &&
      max.effective < min.effective
    ) {
      add(
        label,
        `${rangeLabel}: max ${max.effective} is below min ${min.effective}.`,
        "consistency"
      )
      return
    }
    if (ownHas(maxField))
      add(
        label,
        looseningWarning(
          label.toLowerCase(),
          max.baseline,
          max.effective,
          "max"
        ),
        "loosening"
      )
  }

  // occurs included: `maxOccurs: 0` only consistently excludes when min is 0 too;
  // any max below min (e.g. an exclusion that still requires the element) is an
  // empty range and flagged like the others.
  maxPair(
    "maxOccurs",
    "minOccurs",
    "Max occurs",
    "Occurs",
    maxOccurs,
    minOccurs
  )
  maxPair(
    "maxLength",
    "minLength",
    "Max length",
    "Length",
    maxLength,
    minLength
  )
  maxPair(
    "maxInclusive",
    "minInclusive",
    "Max inclusive",
    "Inclusive",
    maxInclusive,
    minInclusive
  )

  // Digit facets loosen when raised (allow more digits).
  if (ownHas("totalDigits"))
    add(
      "Total digits",
      looseningWarning(
        "total digits",
        totalDigits.baseline,
        totalDigits.effective,
        "max"
      ),
      "loosening"
    )
  if (ownHas("fractionDigits"))
    add(
      "Fraction digits",
      looseningWarning(
        "fraction digits",
        fractionDigits.baseline,
        fractionDigits.effective,
        "max"
      ),
      "loosening"
    )

  if (ownHas("pattern"))
    add("Pattern", patternWarning(own.pattern ?? null), "consistency")

  // Allowed values must stay a subset of the inherited/standard code set.
  if (ownHas("allowedValues") && own.allowedValues != null) {
    const inheritedList = inh("allowedValues")
    const base = inheritedList
      ? (inherited!.allowedValues ?? [])
      : element.codes.map((c) => c.codeName)
    // External code sets are open: the ISO snapshot isn't exhaustive, so listing
    // values beyond it isn't an inconsistency. A MIG ancestor that *restricted*
    // the list is still meaningful, so only waive the check against the ISO set.
    const openExternal = !inheritedList && isExternalCodeSet(element)
    if (base.length > 0 && !openExternal) {
      const set = new Set(base)
      const extra = own.allowedValues.filter((v) => !set.has(v))
      if (extra.length > 0)
        add(
          "Allowed values",
          `Adds values outside the standard set: ${extra.join(", ")}`,
          "consistency"
        )
    }
  }

  // Disabling a rule drops a restriction — looser, unless an ancestor already
  // disabled it (then this MIG adds nothing).
  for (const [name, co] of Object.entries(own.constraintOverrides ?? {})) {
    const inhDisabled =
      inherited?.constraintOverrides?.[name]?.disabled === true
    if (co.disabled === true && !inhDisabled) {
      add(
        "Constraint",
        `Disables the "${name}" rule — looser than the original.`,
        "loosening"
      )
    }
  }

  return out
}

/**
 * Validate a MIG against its inherited baseline and the ISO message, returning
 * advisory loosening/consistency diagnostics for every path it overrides.
 * `inherited` is the merged parent-chain overrides (empty when there's no parent).
 */
export function validateMigConsistency(
  mig: MessageImplementationGuide,
  inherited: ElementOverrides,
  message: MessageDefinition
): Diagnostic[] {
  const out: Diagnostic[] = []
  for (const [path, own] of Object.entries(mig.elementOverrides)) {
    const element = elementAtPath(message.rootElement, path)
    if (!element) continue
    for (const { field, message: msg, kind } of elementDiagnostics(
      element,
      inherited[path],
      own
    )) {
      out.push({ path, elementName: element.name, field, message: msg, kind })
    }
  }
  return out
}
