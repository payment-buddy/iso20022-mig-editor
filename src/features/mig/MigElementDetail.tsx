import { type ReactNode } from "react"
import { ArrowCounterClockwise } from "@phosphor-icons/react"
import type { ElementOverride, MessageElement } from "@/core/types/types"
import { InlineEdit } from "@/components/ui/inline-edit"
import { DetailPanel, Field } from "@/features/repository/ElementTree"

/** Base types that carry a length facet (FUNCTIONALITY §5.7). */
const LENGTH_BASE_TYPES = new Set(["Text", "CodeSet", "IdentifierSet", "Binary"])

/** Base types that carry an inclusive-range facet (values may be decimals). */
const INCLUSIVE_BASE_TYPES = new Set(["Year", "Amount", "Quantity", "Rate"])

/** Base types that carry a pattern (regex) facet. */
const PATTERN_BASE_TYPES = new Set(["Text", "CodeSet", "IdentifierSet", "DateTime", "Quantity"])

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
  onSet,
  onClear,
}: {
  element: MessageElement
  path: string
  override: ElementOverride | undefined
  /** Persist one override field. */
  onSet: <K extends keyof ElementOverride>(field: K, value: ElementOverride[K]) => void
  /** Drop one override field (back to inherited). */
  onClear: (field: keyof ElementOverride) => void
}) {
  // Key-presence, not truthiness: a stored `null` still counts as overridden.
  const has = (field: keyof ElementOverride) => override !== undefined && field in override

  // Definition (text).
  const defOverridden = has("definition")
  const defBaseline = element.definition
  const defEffective = defOverridden ? (override?.definition ?? "") : defBaseline
  const commitDefinition = (text: string) =>
    text === defBaseline ? onClear("definition") : onSet("definition", text)

  // An exact `length` acts as the baseline for both min and max length.
  const baseMinLength = element.minLength ?? element.length
  const baseMaxLength = element.maxLength ?? element.length
  const showLength = element.baseType !== null && LENGTH_BASE_TYPES.has(element.baseType)
  const showInclusive = element.baseType !== null && INCLUSIVE_BASE_TYPES.has(element.baseType)
  const showPattern = element.baseType !== null && PATTERN_BASE_TYPES.has(element.baseType)

  // Pattern (regex text). Empty means "no pattern" (null = remove the constraint).
  const patternOverridden = has("pattern")
  const basePattern = element.pattern
  const patternEffective = patternOverridden ? (override?.pattern ?? "") : (basePattern ?? "")
  const commitPattern = (text: string) => {
    const value = text === "" ? null : text
    if (value === basePattern) onClear("pattern")
    else onSet("pattern", value)
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
        baseline={defBaseline || <em>none</em>}
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
          baseline={element.minOccurs}
          overridden={has("minOccurs")}
          effective={has("minOccurs") ? (override?.minOccurs ?? element.minOccurs) : element.minOccurs}
          allowNull={false}
          emptyLabel="0"
          onSet={(v) => onSet("minOccurs", v)}
          onClear={() => onClear("minOccurs")}
        />
        <NumberOverrideField
          label="Max occurs"
          ariaLabel="Max occurs"
          baseline={element.maxOccurs}
          overridden={has("maxOccurs")}
          effective={has("maxOccurs") ? (override?.maxOccurs ?? null) : element.maxOccurs}
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
            baseline={baseMinLength}
            overridden={has("minLength")}
            effective={has("minLength") ? (override?.minLength ?? null) : baseMinLength}
            allowNull
            emptyLabel="none"
            onSet={(v) => onSet("minLength", v)}
            onClear={() => onClear("minLength")}
          />
          <NumberOverrideField
            label="Max length"
            ariaLabel="Max length"
            baseline={baseMaxLength}
            overridden={has("maxLength")}
            effective={has("maxLength") ? (override?.maxLength ?? null) : baseMaxLength}
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
            baseline={element.minInclusive}
            overridden={has("minInclusive")}
            effective={has("minInclusive") ? (override?.minInclusive ?? null) : element.minInclusive}
            allowNull
            integer={false}
            emptyLabel="none"
            onSet={(v) => onSet("minInclusive", v)}
            onClear={() => onClear("minInclusive")}
          />
          <NumberOverrideField
            label="Max inclusive"
            ariaLabel="Max inclusive"
            baseline={element.maxInclusive}
            overridden={has("maxInclusive")}
            effective={has("maxInclusive") ? (override?.maxInclusive ?? null) : element.maxInclusive}
            allowNull
            integer={false}
            emptyLabel="none"
            onSet={(v) => onSet("maxInclusive", v)}
            onClear={() => onClear("maxInclusive")}
          />
        </div>
      )}

      {showPattern && (
        <OverrideRow
          label="Pattern"
          overridden={patternOverridden}
          baseline={basePattern ? <code className="text-xs break-all">{basePattern}</code> : <em>none</em>}
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
    </DetailPanel>
  )
}

/**
 * A numeric override field (occurs, length, …). `allowNull` controls whether an
 * empty input means "no constraint" (`null`) — true for the nullable facets,
 * false for min-occurs which must stay a number. `emptyLabel` is shown for a
 * `null` value (e.g. "unbounded", "none") and used as the edit placeholder.
 */
function NumberOverrideField({
  label,
  ariaLabel,
  baseline,
  overridden,
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
  effective: number | null
  allowNull: boolean
  emptyLabel: string
  /** Require a whole number (occurs/length) vs. allow decimals (inclusive). */
  integer?: boolean
  onSet: (value: number | null) => void
  onClear: () => void
}) {
  const fmt = (v: number | null) => (v === null ? emptyLabel : String(v))

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
    <OverrideRow label={label} overridden={overridden} baseline={fmt(baseline)} onReset={onClear}>
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
 * One editable override field: a label with a reset-to-inherited action shown
 * when overridden, the editor, and an "Overridden / Inherited: …" hint.
 */
function OverrideRow({
  label,
  overridden,
  baseline,
  onReset,
  children,
}: {
  label: string
  overridden: boolean
  baseline: ReactNode
  onReset: () => void
  children: ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[0.625rem] tracking-wide text-muted-foreground uppercase">{label}</div>
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
      {overridden && (
        <p className="mt-1 px-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Overridden.</span> Inherited:{" "}
          <span className="whitespace-pre-wrap">{baseline}</span>
        </p>
      )}
    </div>
  )
}
