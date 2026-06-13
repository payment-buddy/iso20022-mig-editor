import { type ReactNode } from "react"
import { ArrowCounterClockwise, Plus, Warning } from "@phosphor-icons/react"
import type { ElementOverride, MessageElement } from "@/core/types/types"
import {
  createValueValidator,
  looseningWarning,
  patternWarning,
  rangeWarning,
} from "@/core/mig/fieldValidation"
import { EditableList } from "@/components/ui/editable-list"
import { InlineEdit } from "@/components/ui/inline-edit"
import { DetailPanel, Field } from "@/features/repository/ElementTree"

/** Base types that carry a length facet (FUNCTIONALITY §5.7). */
const LENGTH_BASE_TYPES = new Set(["Text", "CodeSet", "IdentifierSet", "Binary"])

/** Base types that carry an inclusive-range facet (values may be decimals). */
const INCLUSIVE_BASE_TYPES = new Set(["Year", "Amount", "Quantity", "Rate"])

/** Base types that carry total/fraction-digits facets. */
const DIGITS_BASE_TYPES = new Set(["Amount", "Quantity", "Rate"])

/** Base types that carry a pattern (regex) facet. */
const PATTERN_BASE_TYPES = new Set(["Text", "CodeSet", "IdentifierSet", "DateTime", "Quantity"])

/** Base types that carry an enumerated allowed-values facet. */
const ALLOWED_VALUES_BASE_TYPES = new Set(["Text", "CodeSet"])

const arraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i])

/**
 * Element detail/edit panel for the MIG Editor (FUNCTIONALITY §5.7). Read-only
 * identity fields plus editable override fields, each showing its inherited
 * baseline with an overridden flag + reset-to-inherited affordance. This slice
 * covers **Definition**, **Min/Max Occurs**, and **Min/Max Length** (the latter
 * only for length-bearing base types). Inclusive/digits/etc. follow.
 */
export function MigElementDetail({
  element,
  path,
  override,
  inherited,
  propertyNames,
  onSet,
  onClear,
  onAddConstraint,
}: {
  element: MessageElement
  path: string
  override: ElementOverride | undefined
  /**
   * Effective override inherited from the parent-MIG chain (merged), used as the
   * baseline a field shows and resets to. Absent fields fall back to the ISO
   * standard. Omitted when this MIG has no (loaded) parent.
   */
  inherited: ElementOverride | undefined
  /** Declared MIG-level annotation names (managed in the metadata block). */
  propertyNames: string[]
  /** Persist one override field. */
  onSet: <K extends keyof ElementOverride>(field: K, value: ElementOverride[K]) => void
  /** Drop one override field (back to inherited). */
  onClear: (field: keyof ElementOverride) => void
  /** Add a MIG-specific constraint to this element and select it in the tree. */
  onAddConstraint: () => void
}) {
  // Key-presence, not truthiness: a stored `null` still counts as set.
  const has = (field: keyof ElementOverride) => override !== undefined && field in override
  const inh = (field: keyof ElementOverride) => inherited !== undefined && field in inherited
  // A field shown without its own override but set by a parent reads "inherited".
  const inheritedHere = (field: keyof ElementOverride) => !has(field) && inh(field)
  // Baseline number = the parent's value if it sets one, else the ISO standard.
  const numBaseline = (field: keyof ElementOverride, iso: number | null): number | null => {
    const v = inherited?.[field]
    return inh(field) && (typeof v === "number" || v === null) ? v : iso
  }
  // Per-field state for a numeric facet: baseline (inherited-or-ISO), own-override
  // and inherited flags, and the effective value in force.
  const numField = (field: keyof ElementOverride, iso: number | null) => {
    const baseline = numBaseline(field, iso)
    const overridden = has(field)
    const raw = override?.[field]
    return {
      baseline,
      overridden,
      inherited: inheritedHere(field),
      effective: overridden ? (typeof raw === "number" ? raw : null) : baseline,
    }
  }

  // Definition (text). Inherited-or-ISO baseline.
  const defOverridden = has("definition")
  const defBaseline = inh("definition") ? (inherited?.definition ?? "") : element.definition
  const defEffective = defOverridden ? (override?.definition ?? "") : defBaseline
  const commitDefinition = (text: string) =>
    text === defBaseline ? onClear("definition") : onSet("definition", text)

  // Numeric facets (occurs / length / inclusive / digits). An exact `length`
  // acts as the ISO baseline for both min and max length.
  const minOccurs = numField("minOccurs", element.minOccurs)
  const maxOccurs = numField("maxOccurs", element.maxOccurs)
  const minLength = numField("minLength", element.minLength ?? element.length)
  const maxLength = numField("maxLength", element.maxLength ?? element.length)
  const minInclusive = numField("minInclusive", element.minInclusive)
  const maxInclusive = numField("maxInclusive", element.maxInclusive)
  const totalDigits = numField("totalDigits", element.totalDigits)
  const fractionDigits = numField("fractionDigits", element.fractionDigits)

  // Loosening / range warnings (advisory, FUNCTIONALITY §5.7).
  const minOccursWarn = looseningWarning("min occurs", minOccurs.baseline, minOccurs.effective, "min")
  // Any max occurs below min occurs is flagged — including `maxOccurs: 0`
  // (exclusion) while min still requires the element. Set min occurs to 0 too for
  // a clean exclusion.
  const maxOccursWarn =
    maxOccurs.effective !== null &&
    minOccurs.effective !== null &&
    maxOccurs.effective < minOccurs.effective
      ? `Occurs: max ${maxOccurs.effective} is below min ${minOccurs.effective}.`
      : looseningWarning("max occurs", maxOccurs.baseline, maxOccurs.effective, "max")
  const minLengthWarn = looseningWarning("min length", minLength.baseline, minLength.effective, "min")
  const maxLengthWarn =
    rangeWarning("Length", minLength.effective, maxLength.effective) ??
    looseningWarning("max length", maxLength.baseline, maxLength.effective, "max")
  const minInclusiveWarn = looseningWarning(
    "min inclusive",
    minInclusive.baseline,
    minInclusive.effective,
    "min",
  )
  const maxInclusiveWarn =
    rangeWarning("Inclusive", minInclusive.effective, maxInclusive.effective) ??
    looseningWarning("max inclusive", maxInclusive.baseline, maxInclusive.effective, "max")
  const totalDigitsWarn = looseningWarning(
    "total digits",
    totalDigits.baseline,
    totalDigits.effective,
    "max",
  )
  const fractionDigitsWarn = looseningWarning(
    "fraction digits",
    fractionDigits.baseline,
    fractionDigits.effective,
    "max",
  )

  const showLength = element.baseType !== null && LENGTH_BASE_TYPES.has(element.baseType)
  const showInclusive = element.baseType !== null && INCLUSIVE_BASE_TYPES.has(element.baseType)
  const showDigits = element.baseType !== null && DIGITS_BASE_TYPES.has(element.baseType)
  const showPattern = element.baseType !== null && PATTERN_BASE_TYPES.has(element.baseType)

  // Pattern (regex text). Empty means "no pattern" (null = remove the constraint).
  const patternOverridden = has("pattern")
  const basePattern = inh("pattern") ? (inherited?.pattern ?? null) : element.pattern
  const patternEffective = patternOverridden ? (override?.pattern ?? "") : (basePattern ?? "")
  const patternWarn = patternWarning(patternEffective || null)
  const commitPattern = (text: string) => {
    const value = text === "" ? null : text
    if (value === basePattern) onClear("pattern")
    else onSet("pattern", value)
  }

  // Allowed values (enumerated). Baseline is the inherited list, else the ISO code set.
  const showAllowedValues =
    element.baseType !== null && ALLOWED_VALUES_BASE_TYPES.has(element.baseType)
  const baseAllowedValues = inh("allowedValues")
    ? (inherited?.allowedValues ?? [])
    : element.codes.map((c) => c.codeName)
  const allowedOverridden = has("allowedValues")
  const effectiveAllowed = allowedOverridden
    ? (override?.allowedValues ?? [])
    : baseAllowedValues
  const commitAllowed = (values: string[]) => {
    // Empty or back-to-inherited means "no override" (matches the legacy model).
    if (values.length === 0 || arraysEqual(values, baseAllowedValues)) onClear("allowedValues")
    else onSet("allowedValues", values)
  }

  // Examples (simple types only).
  const showExamples = element.baseType !== null
  const baseExamples = inh("examples") ? (inherited?.examples ?? []) : element.examples
  const examplesOverridden = has("examples")
  const effectiveExamples = examplesOverridden ? (override?.examples ?? []) : baseExamples
  const commitExamples = (values: string[]) => {
    if (values.length === 0 || arraysEqual(values, baseExamples)) onClear("examples")
    else onSet("examples", values)
  }

  // Allowed values and examples are validated against the effective (inherited +
  // own) length/pattern, so an inherited constraint still applies.
  const validateValue = createValueValidator(element, { ...inherited, ...override })

  // Custom property values for this element (names are declared MIG-level).
  const customValues = override?.annotations ?? {}
  const setCustomValue = (name: string, value: string) => {
    const next = { ...customValues }
    if (value.trim() === "") delete next[name]
    else next[name] = value
    if (Object.keys(next).length === 0) onClear("annotations")
    else onSet("annotations", next)
  }

  return (
    <DetailPanel label="Element details">
      <div className="font-medium">{element.name}</div>
      <Field label={element.isAttribute ? "XML attribute" : "XML tag"}>
        <code className="text-xs">{element.xmlTag}</code>
      </Field>
      <Field label="XML path">
        <code className="text-xs">{path}</code>
      </Field>
      <Field label="Type">
        {element.type}
        {element.baseType && <span className="text-muted-foreground"> ({element.baseType})</span>}
      </Field>

      <OverrideRow
        label="Definition"
        overridden={defOverridden}
        inherited={inheritedHere("definition")}
        baseline={defBaseline || "none"}
        onReset={() => onClear("definition")}
      >
        <InlineEdit
          value={defEffective}
          onCommit={commitDefinition}
          ariaLabel="Definition"
          placeholder="Add a definition…"
          multiline
        />
      </OverrideRow>

      <div className="grid grid-cols-2 gap-3">
        <NumberOverrideField
          label="Min occurs"
          ariaLabel="Min occurs"
          baseline={minOccurs.baseline}
          overridden={minOccurs.overridden}
          inherited={minOccurs.inherited}
          warning={minOccursWarn}
          effective={minOccurs.effective}
          allowNull={false}
          emptyLabel="0"
          onSet={(v) => onSet("minOccurs", v)}
          onClear={() => onClear("minOccurs")}
        />
        <NumberOverrideField
          label="Max occurs"
          ariaLabel="Max occurs"
          baseline={maxOccurs.baseline}
          overridden={maxOccurs.overridden}
          inherited={maxOccurs.inherited}
          warning={maxOccursWarn}
          effective={maxOccurs.effective}
          allowNull
          emptyLabel="unbounded"
          onSet={(v) => onSet("maxOccurs", v)}
          onClear={() => onClear("maxOccurs")}
        />
      </div>

      {showLength && (
        <div className="grid grid-cols-2 gap-3">
          <NumberOverrideField
            label="Min length"
            ariaLabel="Min length"
            baseline={minLength.baseline}
            overridden={minLength.overridden}
            inherited={minLength.inherited}
            warning={minLengthWarn}
            effective={minLength.effective}
            allowNull
            emptyLabel="none"
            onSet={(v) => onSet("minLength", v)}
            onClear={() => onClear("minLength")}
          />
          <NumberOverrideField
            label="Max length"
            ariaLabel="Max length"
            baseline={maxLength.baseline}
            overridden={maxLength.overridden}
            inherited={maxLength.inherited}
            warning={maxLengthWarn}
            effective={maxLength.effective}
            allowNull
            emptyLabel="none"
            onSet={(v) => onSet("maxLength", v)}
            onClear={() => onClear("maxLength")}
          />
        </div>
      )}

      {showInclusive && (
        <div className="grid grid-cols-2 gap-3">
          <NumberOverrideField
            label="Min inclusive"
            ariaLabel="Min inclusive"
            baseline={minInclusive.baseline}
            overridden={minInclusive.overridden}
            inherited={minInclusive.inherited}
            warning={minInclusiveWarn}
            effective={minInclusive.effective}
            allowNull
            integer={false}
            emptyLabel="none"
            onSet={(v) => onSet("minInclusive", v)}
            onClear={() => onClear("minInclusive")}
          />
          <NumberOverrideField
            label="Max inclusive"
            ariaLabel="Max inclusive"
            baseline={maxInclusive.baseline}
            overridden={maxInclusive.overridden}
            inherited={maxInclusive.inherited}
            warning={maxInclusiveWarn}
            effective={maxInclusive.effective}
            allowNull
            integer={false}
            emptyLabel="none"
            onSet={(v) => onSet("maxInclusive", v)}
            onClear={() => onClear("maxInclusive")}
          />
        </div>
      )}

      {showDigits && (
        <div className="grid grid-cols-2 gap-3">
          <NumberOverrideField
            label="Total digits"
            ariaLabel="Total digits"
            baseline={totalDigits.baseline}
            overridden={totalDigits.overridden}
            inherited={totalDigits.inherited}
            warning={totalDigitsWarn}
            effective={totalDigits.effective}
            allowNull
            emptyLabel="none"
            onSet={(v) => onSet("totalDigits", v)}
            onClear={() => onClear("totalDigits")}
          />
          <NumberOverrideField
            label="Fraction digits"
            ariaLabel="Fraction digits"
            baseline={fractionDigits.baseline}
            overridden={fractionDigits.overridden}
            inherited={fractionDigits.inherited}
            warning={fractionDigitsWarn}
            effective={fractionDigits.effective}
            allowNull
            emptyLabel="none"
            onSet={(v) => onSet("fractionDigits", v)}
            onClear={() => onClear("fractionDigits")}
          />
        </div>
      )}

      {showPattern && (
        <OverrideRow
          label="Pattern"
          overridden={patternOverridden}
          inherited={inheritedHere("pattern")}
          warning={patternWarn}
          baseline={basePattern || "none"}
          onReset={() => onClear("pattern")}
        >
          <InlineEdit
            value={patternEffective}
            onCommit={commitPattern}
            ariaLabel="Pattern"
            placeholder="No pattern"
          />
        </OverrideRow>
      )}

      {showAllowedValues && (
        <OverrideRow
          label="Allowed values"
          overridden={allowedOverridden}
          inherited={inheritedHere("allowedValues")}
          baseline={summarize(baseAllowedValues)}
          onReset={() => onClear("allowedValues")}
        >
          <EditableList
            values={effectiveAllowed}
            onChange={commitAllowed}
            ariaLabel="Allowed values"
            placeholder="Add an allowed value…"
            validate={validateValue}
          />
        </OverrideRow>
      )}

      {showExamples && (
        <OverrideRow
          label="Examples"
          overridden={examplesOverridden}
          inherited={inheritedHere("examples")}
          baseline={summarize(baseExamples)}
          onReset={() => onClear("examples")}
        >
          <EditableList
            values={effectiveExamples}
            onChange={commitExamples}
            ariaLabel="Examples"
            placeholder="Add an example…"
            validate={validateValue}
          />
        </OverrideRow>
      )}

      {propertyNames.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[0.625rem] tracking-wide text-muted-foreground uppercase">
            Annotations
          </div>
          {propertyNames.map((name) => (
            <div key={name} className="flex items-start gap-2">
              <div className="w-28 shrink-0 pt-1.5 text-xs font-medium break-words">{name}</div>
              <div className="min-w-0 flex-1">
                <InlineEdit
                  value={customValues[name] ?? ""}
                  onCommit={(v) => setCustomValue(name, v)}
                  ariaLabel={`${name} value`}
                  placeholder="—"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-border pt-3">
        <button
          type="button"
          onClick={onAddConstraint}
          className="flex items-center gap-1 rounded-sm text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <Plus className="size-3.5" aria-hidden />
          Add constraint
        </button>
      </div>
    </DetailPanel>
  )
}

/** A short, tooltip-friendly summary of a value list. */
function summarize(values: string[]): string {
  if (values.length === 0) return "none"
  const head = values.slice(0, 8).join(", ")
  return values.length > 8 ? `${head}, … (${values.length})` : head
}

/**
 * A numeric override field (occurs, length, …). `allowNull` controls whether an
 * empty input means "no constraint" (`null`) — true for the nullable facets,
 * false for min-occurs which must stay a number. A `null` value reads as
 * `<none>`; `emptyLabel` is the edit placeholder hinting what empty means
 * (e.g. "unbounded", "none").
 */
function NumberOverrideField({
  label,
  ariaLabel,
  baseline,
  overridden,
  inherited = false,
  warning = null,
  effective,
  allowNull,
  emptyLabel,
  integer = true,
  onSet,
  onClear,
}: {
  label: string
  ariaLabel: string
  baseline: number | null
  overridden: boolean
  inherited?: boolean
  warning?: string | null
  effective: number | null
  allowNull: boolean
  emptyLabel: string
  /** Require a whole number (occurs/length) vs. allow decimals (inclusive). */
  integer?: boolean
  onSet: (value: number | null) => void
  onClear: () => void
}) {
  // Empty facet reads as "<none>" in view/tooltip (consistent with text fields);
  // `emptyLabel` is only the editing hint for what leaving it empty means.
  const fmt = (v: number | null) => (v === null ? "<none>" : String(v))

  const commit = (text: string) => {
    const t = text.trim()
    let value: number | null
    if (t === "") {
      if (!allowNull) return // ignore: this facet must remain a number
      value = null
    } else {
      const n = Number(t)
      const valid = (integer ? Number.isInteger(n) : Number.isFinite(n)) && n >= 0
      if (!valid) return // ignore invalid input
      value = n
    }
    if (value === baseline) onClear()
    else onSet(value)
  }

  return (
    <OverrideRow
      label={label}
      overridden={overridden}
      inherited={inherited}
      warning={warning}
      baseline={fmt(baseline)}
      onReset={onClear}
    >
      <InlineEdit
        value={effective === null ? "" : String(effective)}
        display={fmt(effective)}
        onCommit={commit}
        ariaLabel={ariaLabel}
        placeholder={emptyLabel}
        type="number"
      />
    </OverrideRow>
  )
}

/**
 * One editable override field: a label, plus a state affordance — a primary dot
 * + reset when **overridden here**, or a muted "inherited" badge when the value
 * comes from a parent MIG (otherwise it's the unmarked ISO original). Both
 * carry the baseline in their tooltip.
 */
function OverrideRow({
  label,
  overridden,
  inherited = false,
  warning = null,
  baseline,
  onReset,
  children,
}: {
  label: string
  overridden: boolean
  inherited?: boolean
  /** Advisory loosening warning shown beneath the field. */
  warning?: string | null
  baseline: string
  onReset: () => void
  children: ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[0.625rem] tracking-wide text-muted-foreground uppercase">
            {label}
          </span>
          {overridden ? (
            <span
              title={`Overridden — inherited: ${baseline}`}
              aria-label={`Overridden — inherited: ${baseline}`}
              className="size-1.5 shrink-0 cursor-help rounded-full bg-primary"
            />
          ) : inherited ? (
            <span
              title={`Inherited from a parent MIG: ${baseline}`}
              aria-label={`Inherited from a parent MIG: ${baseline}`}
              className="cursor-help rounded-sm bg-muted px-1 text-[0.5rem] tracking-wide text-muted-foreground uppercase"
            >
              inherited
            </span>
          ) : null}
        </div>
        {overridden && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 rounded-sm text-[0.625rem] text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <ArrowCounterClockwise className="size-3" aria-hidden />
            Reset to inherited
          </button>
        )}
      </div>
      {children}
      {warning && (
        <p
          role="alert"
          className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500"
        >
          <Warning className="size-3 shrink-0" aria-hidden />
          {warning}
        </p>
      )}
    </div>
  )
}
