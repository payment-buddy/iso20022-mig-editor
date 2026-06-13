import { ArrowCounterClockwiseIcon, CheckIcon, WarningIcon } from "@phosphor-icons/react"
import type { Constraint, ConstraintOverride, MessageElement } from "@/core/types/types"
import { validateConstraintExpression } from "@/core/mig/expression"
import { InlineEdit } from "@/components/ui/inline-edit"
import { DetailPanel, Field } from "@/features/repository/ElementTree"

/**
 * Detail panel for a standard (ISO) or inherited constraint (FUNCTIONALITY §5.7).
 * The name and definition are read-only (the ISO rule's identity), but the MIG
 * can overlay a formal **expression** on top — tri-state like every other
 * override (absent = inherit, value = set), with a "Reset to inherited"
 * affordance and the same advisory syntax/path warnings as MIG-added constraints.
 */
export function MigStandardConstraintDetail({
  constraint,
  element,
  path,
  override,
  inherited,
  onSetExpression,
  onClearExpression,
}: {
  /** The base standard/inherited constraint (its ISO/ancestor name + definition). */
  constraint: Constraint
  /** The element this constraint is attached to — paths resolve against it. */
  element: MessageElement | null
  /** Full xmlPath of the constraint (for display). */
  path: string
  /** This MIG's own overlay entry for the constraint (undefined = none). */
  override: ConstraintOverride | undefined
  /** The inherited (parent-chain) overlay entry for the constraint. */
  inherited: ConstraintOverride | undefined
  onSetExpression: (value: string | null) => void
  onClearExpression: () => void
}) {
  // Inherited baseline: a parent's overlay if it sets one, else the ISO
  // constraint's own expression (usually none). Own overlay wins when present.
  const baseExpression =
    inherited && "expression" in inherited ? inherited.expression : (constraint.expression ?? null)
  const overridden = override !== undefined && "expression" in override
  const effective = overridden ? (override.expression ?? null) : baseExpression
  const expressionText = effective ?? ""

  const commitExpression = (text: string) => {
    const value = text === "" ? null : text
    // Back to the inherited baseline → drop the override (stay minimal).
    if (value === baseExpression) onClearExpression()
    else onSetExpression(value)
  }

  const expressionWarnings = validateConstraintExpression(expressionText, element)

  return (
    <DetailPanel label="Constraint details">
      <div className="flex items-center gap-1.5 font-medium">
        <CheckIcon className="size-3.5 text-muted-foreground" aria-hidden />
        {constraint.name}
      </div>
      <Field label="Path">
        <code className="text-xs">{path}</code>
      </Field>
      {constraint.definition && (
        <Field label="Definition">
          <span className="whitespace-pre-wrap">{constraint.definition}</span>
        </Field>
      )}
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-[0.625rem] tracking-wide text-muted-foreground uppercase">
            Expression
          </div>
          {overridden && (
            <button
              type="button"
              onClick={onClearExpression}
              className="flex items-center gap-1 rounded-sm text-[0.625rem] text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <ArrowCounterClockwiseIcon className="size-3" aria-hidden />
              Reset to inherited
            </button>
          )}
        </div>
        <InlineEdit
          value={expressionText}
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
      </div>
    </DetailPanel>
  )
}
