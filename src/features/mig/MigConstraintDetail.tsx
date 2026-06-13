import { useState } from "react"
import { Check, Trash, Warning } from "@phosphor-icons/react"
import type { Constraint, MessageElement } from "@/core/types/types"
import { validateConstraintExpression } from "@/core/mig/expression"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { InlineEdit } from "@/components/ui/inline-edit"
import { DetailPanel, Field } from "@/features/repository/ElementTree"

/**
 * Editable detail panel for a MIG-specific (additional) constraint
 * (FUNCTIONALITY §5.7): inline-edit name, definition, expression and custom
 * properties. The name stays unique within the element — a rename that is blank,
 * unchanged, or already taken by a sibling constraint is rejected (the field
 * reverts). Standard, spec-inherited constraints use the read-only view instead.
 */
export function MigConstraintDetail({
  constraint,
  element,
  path,
  takenNames,
  annotationNames,
  onRename,
  onSetDefinition,
  onSetExpression,
  onSetAnnotations,
  onDelete,
}: {
  constraint: Constraint
  /** The element this constraint is attached to — paths resolve against it. */
  element: MessageElement | null
  /** Full xmlPath of the constraint (for display). */
  path: string
  /** Sibling constraint names (standard + other additional), excluding this one. */
  takenNames: string[]
  /** Declared MIG-level constraint-annotation names (managed in the metadata block). */
  annotationNames: string[]
  onRename: (name: string) => void
  onSetDefinition: (definition: string) => void
  onSetExpression: (expression: string) => void
  onSetAnnotations: (annotations: Record<string, string | null>) => void
  onDelete: () => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const commitName = (text: string) => {
    const name = text.trim()
    if (name === "" || name === constraint.name || takenNames.includes(name)) return
    onRename(name)
  }
  const commitDefinition = (text: string) => {
    if (text !== constraint.definition) onSetDefinition(text)
  }
  // Expression is optional; empty clears it (pruned upstream).
  const expression = constraint.expression ?? ""
  const commitExpression = (text: string) => {
    if (text !== expression) onSetExpression(text)
  }
  // Advisory syntax + path checks (never block editing/export, per §5.7): paths
  // must resolve to nested elements/attributes of this constraint's element.
  const expressionWarnings = validateConstraintExpression(expression, element)

  // Per-constraint annotation values (names are declared MIG-level). Empty
  // clears the value; an emptied map prunes the override (handled upstream).
  const annotationValues = constraint.annotations ?? {}
  const setAnnotation = (name: string, value: string) => {
    const next = { ...annotationValues }
    if (value.trim() === "") delete next[name]
    else next[name] = value
    onSetAnnotations(next)
  }

  return (
    <DetailPanel label="Constraint details">
      <div className="flex items-center gap-1.5">
        <Check className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1 font-medium">
          <InlineEdit
            value={constraint.name}
            onCommit={commitName}
            ariaLabel="Constraint name"
            placeholder="Constraint name"
          />
        </div>
      </div>
      <Field label="Path">
        <code className="text-xs">{path}</code>
      </Field>
      <div>
        <div className="text-[0.625rem] tracking-wide text-muted-foreground uppercase">
          Definition
        </div>
        <InlineEdit
          value={constraint.definition}
          onCommit={commitDefinition}
          ariaLabel="Constraint definition"
          placeholder="Add a definition…"
          multiline
        />
      </div>
      <div>
        <div className="text-[0.625rem] tracking-wide text-muted-foreground uppercase">
          Expression
        </div>
        <InlineEdit
          value={expression}
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
            <Warning className="size-3 shrink-0" aria-hidden />
            {warning}
          </p>
        ))}
      </div>

      {annotationNames.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[0.625rem] tracking-wide text-muted-foreground uppercase">
            Annotations
          </div>
          {annotationNames.map((name) => (
            <div key={name} className="flex items-start gap-2">
              <div className="w-28 shrink-0 pt-1.5 text-xs font-medium break-words">{name}</div>
              <div className="min-w-0 flex-1">
                <InlineEdit
                  value={annotationValues[name] ?? ""}
                  onCommit={(v) => setAnnotation(name, v)}
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
          onClick={() => setConfirmOpen(true)}
          className="flex items-center gap-1 rounded-sm text-xs font-medium text-destructive outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <Trash className="size-3.5" aria-hidden />
          Delete constraint
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete “${constraint.name}”?`}
        description="This removes the constraint from this MIG. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={onDelete}
      />
    </DetailPanel>
  )
}
