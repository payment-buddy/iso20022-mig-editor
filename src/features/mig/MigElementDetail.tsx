import { type ReactNode } from "react"
import { ArrowCounterClockwise } from "@phosphor-icons/react"
import type { ElementOverride, MessageElement } from "@/core/types/types"
import { InlineEdit } from "@/components/ui/inline-edit"
import { DetailPanel, Field } from "@/features/repository/ElementTree"

/**
 * Element detail/edit panel for the MIG Editor (FUNCTIONALITY §5.7). Read-only
 * identity fields plus editable override fields, each showing its inherited
 * baseline with an overridden flag + reset-to-inherited affordance. This slice
 * covers **Definition** and **Min/Max Occurs**; length/inclusive/etc. follow.
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

  // --- Definition ---
  const defOverridden = has("definition")
  const defBaseline = element.definition
  const defEffective = defOverridden ? (override?.definition ?? "") : defBaseline
  const commitDefinition = (text: string) =>
    text === defBaseline ? onClear("definition") : onSet("definition", text)

  // --- Min occurs ---
  const minOverridden = has("minOccurs")
  const minEffective = minOverridden ? (override?.minOccurs ?? element.minOccurs) : element.minOccurs
  const commitMin = (text: string) => {
    const t = text.trim()
    if (t === "") return
    const n = Number(t)
    if (!Number.isInteger(n) || n < 0) return // ignore invalid input
    if (n === element.minOccurs) onClear("minOccurs")
    else onSet("minOccurs", n)
  }

  // --- Max occurs (null = unbounded, which is also the "remove constraint" state) ---
  const maxOverridden = has("maxOccurs")
  const maxEffective = maxOverridden ? (override?.maxOccurs ?? null) : element.maxOccurs
  const commitMax = (text: string) => {
    const t = text.trim().toLowerCase()
    let value: number | null
    if (t === "" || t === "*" || t === "unbounded" || t === "∞") value = null
    else {
      const n = Number(t)
      if (!Number.isInteger(n) || n < 0) return // ignore invalid input
      value = n
    }
    if (value === element.maxOccurs) onClear("maxOccurs")
    else onSet("maxOccurs", value)
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
        <OverrideRow
          label="Min occurs"
          overridden={minOverridden}
          baseline={String(element.minOccurs)}
          onReset={() => onClear("minOccurs")}
        >
          <InlineEdit
            value={String(minEffective)}
            onCommit={commitMin}
            ariaLabel="Min occurs"
            placeholder="0"
            type="number"
          />
        </OverrideRow>

        <OverrideRow
          label="Max occurs"
          overridden={maxOverridden}
          baseline={formatMax(element.maxOccurs)}
          onReset={() => onClear("maxOccurs")}
        >
          <InlineEdit
            value={maxEffective === null ? "" : String(maxEffective)}
            display={formatMax(maxEffective)}
            onCommit={commitMax}
            ariaLabel="Max occurs"
            placeholder="unbounded"
            type="number"
          />
        </OverrideRow>
      </div>
    </DetailPanel>
  )
}

const formatMax = (v: number | null): string => (v === null ? "unbounded" : String(v))

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
