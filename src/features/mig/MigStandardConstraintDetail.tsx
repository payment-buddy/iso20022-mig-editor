import type { ReactNode } from "react"
import { ArrowCounterClockwiseIcon, CheckIcon, WarningIcon } from "@phosphor-icons/react"
import type { Constraint, ConstraintOverride, MessageElement } from "@/core/types/types"
import { validateConstraintExpression } from "@/core/mig/expression"
import { InlineEdit } from "@/components/ui/inline-edit"
import { DetailPanel, Field } from "@/features/repository/ElementTree"

/**
 * Detail panel for a standard (ISO) or inherited constraint (FUNCTIONALITY §5.7).
 * The name is read-only (the rule's identity), but the MIG can overlay its
 * **definition** and a formal **expression** — tri-state like every other
 * override (absent = inherit, value = set), each with a "Reset to inherited"
 * affordance, and the expression with the same advisory syntax/path warnings as
 * MIG-added constraints.
 */
export function MigStandardConstraintDetail({
  constraint,
  element,
  path,
  override,
  inherited,
  onSetDefinition,
  onClearDefinition,
  onSetExpression,
  onClearExpression,
}: {
  /** The base standard/inherited constraint (its ISO/ancestor name + fields). */
  constraint: Constraint
  /** The element this constraint is attached to — paths resolve against it. */
  element: MessageElement | null
  /** Full xmlPath of the constraint (for display). */
  path: string
  /** This MIG's own overlay entry for the constraint (undefined = none). */
  override: ConstraintOverride | undefined
  /** The inherited (parent-chain) overlay entry for the constraint. */
  inherited: ConstraintOverride | undefined
  onSetDefinition: (value: string | null) => void
  onClearDefinition: () => void
  onSetExpression: (value: string | null) => void
  onClearExpression: () => void
}) {
  // Effective + inherited-baseline for one overlay field. The inherited baseline
  // is a parent's overlay if it sets the field, else the ISO constraint's own
  // value; the own overlay wins when present. Commit drops the override when the
  // value returns to that baseline (stay minimal).
  const field = <K extends keyof ConstraintOverride>(key: K, base: string | null) => {
    const baseline = inherited && key in inherited ? (inherited[key] ?? null) : base
    const overridden = override !== undefined && key in override
    const effective = overridden ? (override[key] ?? null) : baseline
    return { baseline, overridden, text: effective ?? "" }
  }

  const definition = field("definition", constraint.definition)
  const commitDefinition = (text: string) => {
    const value = text === "" ? null : text
    if (value === definition.baseline) onClearDefinition()
    else onSetDefinition(value)
  }

  const expression = field("expression", constraint.expression ?? null)
  const commitExpression = (text: string) => {
    const value = text === "" ? null : text
    if (value === expression.baseline) onClearExpression()
    else onSetExpression(value)
  }
  const expressionWarnings = validateConstraintExpression(expression.text, element)

  return (
    <DetailPanel label="Constraint details">
      <div className="flex items-center gap-1.5 font-medium">
        <CheckIcon className="size-3.5 text-muted-foreground" aria-hidden />
        {constraint.name}
      </div>
      <Field label="Path">
        <code className="text-xs">{path}</code>
      </Field>

      <OverrideField label="Definition" overridden={definition.overridden} onReset={onClearDefinition}>
        <InlineEdit
          value={definition.text}
          onCommit={commitDefinition}
          ariaLabel="Constraint definition"
          placeholder="Add a definition…"
          multiline
        />
      </OverrideField>

      <OverrideField label="Expression" overridden={expression.overridden} onReset={onClearExpression}>
        <InlineEdit
          value={expression.text}
          onCommit={commitExpression}
          ariaLabel="Constraint expression"
          placeholder="Add an expression…"
          multiline
        />
        {expressionWarnings.map((warning) => (
          <p
            key={warning}
            role="alert"
            className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500"
          >
            <WarningIcon className="size-3 shrink-0" aria-hidden />
            {warning}
          </p>
        ))}
      </OverrideField>
    </DetailPanel>
  )
}

/** A labelled field with a "Reset to inherited" affordance shown when overridden. */
function OverrideField({
  label,
  overridden,
  onReset,
  children,
}: {
  label: string
  overridden: boolean
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
            <ArrowCounterClockwiseIcon className="size-3" aria-hidden />
            Reset to inherited
          </button>
        )}
      </div>
      {children}
    </div>
  )
}
