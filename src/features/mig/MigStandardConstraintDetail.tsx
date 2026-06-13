import type { ReactNode } from "react"
import {
  ArrowCounterClockwiseIcon,
  CheckIcon,
  ProhibitIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import type {
  Constraint,
  ConstraintOverride,
  MessageElement,
} from "@/core/types/types"
import { validateConstraintExpression } from "@/core/mig/expression"
import { DotsMenu, type DotsMenuItem } from "@/components/ui/dots-menu"
import { InlineEdit } from "@/components/ui/inline-edit"
import { DetailPanel, Field } from "@/features/repository/ElementTree"
import { ProvenanceDot } from "./ProvenanceDot"

/**
 * Detail panel for a standard (ISO) or inherited constraint.
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
  annotationNames,
  ownAnnotations,
  inheritedAnnotations,
  onSetDefinition,
  onClearDefinition,
  onSetExpression,
  onClearExpression,
  onSetDisabled,
  onClearDisabled,
  onSetAnnotation,
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
  /** Declared constraint-annotation names of the **current** MIG (own list). */
  annotationNames: string[]
  /** This MIG's own annotation overlay for the constraint (by name). */
  ownAnnotations: Record<string, string | null>
  /** Resolved inherited annotation values (parent chain) by name — the baseline. */
  inheritedAnnotations: Record<string, string>
  onSetDefinition: (value: string | null) => void
  onClearDefinition: () => void
  onSetExpression: (value: string | null) => void
  onClearExpression: () => void
  onSetDisabled: (value: boolean) => void
  onClearDisabled: () => void
  /** Set/clear (empty value clears) one annotation overlay for the constraint. */
  onSetAnnotation: (name: string, value: string) => void
}) {
  // Effective + inherited-baseline for one overlay field. The inherited baseline
  // is a parent's overlay if it sets the field, else the ISO constraint's own
  // value; the own overlay wins when present. Commit drops the override when the
  // value returns to that baseline (stay minimal).
  const field = <K extends keyof ConstraintOverride>(
    key: K,
    base: string | null
  ) => {
    const baseline =
      inherited && key in inherited ? (inherited[key] ?? null) : base
    const overridden = override !== undefined && key in override
    // No own override, but a parent sets it → the value is inherited here.
    const inheritedHere =
      !overridden && inherited !== undefined && key in inherited
    const effective = overridden ? (override[key] ?? null) : baseline
    return {
      baseline,
      overridden,
      inherited: inheritedHere,
      text: effective ?? "",
    }
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
  const expressionWarnings = validateConstraintExpression(
    expression.text,
    element
  )

  // Disable toggle (tri-state): the rule is off when the effective override says
  // so; toggling back to the inherited baseline drops the override.
  const disabledBaseline =
    inherited && "disabled" in inherited ? !!inherited.disabled : false
  const disabledOverridden = override !== undefined && "disabled" in override
  const disabledEffective = disabledOverridden
    ? !!override.disabled
    : disabledBaseline
  const toggleDisabled = () => {
    const value = !disabledEffective
    if (value === disabledBaseline) onClearDisabled()
    else onSetDisabled(value)
  }

  // Disabling/enabling lives in a kebab menu on the name row — like the
  // added-constraint panel, but with no Delete (a standard/inherited rule can't
  // be removed). There's no separate "reset to inherited": `toggleDisabled`
  // already drops the override when it returns to the inherited baseline.
  const actions: DotsMenuItem[] = [
    disabledEffective
      ? { label: "Enable", icon: CheckIcon, onSelect: toggleDisabled }
      : { label: "Disable", icon: ProhibitIcon, onSelect: toggleDisabled },
  ]

  return (
    <DetailPanel label="Constraint details">
      <div className="flex items-center gap-1.5 font-medium">
        <CheckIcon
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate">{constraint.name}</span>
        {disabledEffective && (
          <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[0.625rem] font-medium tracking-wide text-muted-foreground uppercase">
            disabled
          </span>
        )}
        <DotsMenu label="Constraint actions" items={actions} />
      </div>
      <Field label="XML path">
        <code className="text-xs">{path.slice(0, path.lastIndexOf("/"))}</code>
      </Field>

      <OverrideField
        label="Definition"
        overridden={definition.overridden}
        inherited={definition.inherited}
        baseline={definition.baseline || "—"}
        onReset={onClearDefinition}
      >
        <InlineEdit
          value={definition.text}
          onCommit={commitDefinition}
          ariaLabel="Constraint definition"
          placeholder="Add a definition…"
          multiline
        />
      </OverrideField>

      <OverrideField
        label="Expression"
        overridden={expression.overridden}
        inherited={expression.inherited}
        baseline={expression.baseline || "none"}
        onReset={onClearExpression}
      >
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

      {annotationNames.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[0.625rem] tracking-wide text-muted-foreground uppercase">
            Annotations
          </div>
          {annotationNames.map((name) => {
            // Annotations have no ISO baseline: a value is set by this MIG (own)
            // or inherited from a parent constraint/overlay; show the effective
            // value + provenance, mirroring the element detail panel.
            const ownVal = ownAnnotations[name]
            const inhVal = inheritedAnnotations[name]
            const overridden = ownVal != null && ownVal !== ""
            const inheritedHere = !overridden && inhVal != null && inhVal !== ""
            const value =
              (overridden ? ownVal : inheritedHere ? inhVal : "") ?? ""
            return (
              <div key={name} className="flex items-start gap-2">
                <div className="flex w-28 shrink-0 items-center gap-1.5 pt-1.5 text-xs font-medium break-words">
                  {name}
                  <ProvenanceDot
                    overridden={overridden}
                    inherited={inheritedHere}
                    baseline={inhVal || "—"}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <InlineEdit
                    value={value}
                    onCommit={(v) => onSetAnnotation(name, v)}
                    ariaLabel={`${name} value`}
                    placeholder="—"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {disabledEffective && (
        <p
          role="alert"
          className="flex items-center gap-1 border-t border-border pt-3 text-xs text-amber-600 dark:text-amber-500"
        >
          <WarningIcon className="size-3 shrink-0" aria-hidden />
          Disabling this rule is looser than the original.
        </p>
      )}
    </DetailPanel>
  )
}

/**
 * A labelled override field: a green dot + reset when overridden here, a blue dot
 * when the value is inherited from a parent MIG (matching the element-tree tints
 * and the element detail panel), else unmarked (ISO original).
 */
function OverrideField({
  label,
  overridden,
  inherited = false,
  baseline,
  onReset,
  children,
}: {
  label: string
  overridden: boolean
  inherited?: boolean
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
          <ProvenanceDot
            overridden={overridden}
            inherited={inherited}
            baseline={baseline}
          />
        </div>
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
