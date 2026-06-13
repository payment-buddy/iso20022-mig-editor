import { useState } from "react"
import { Check, Trash } from "@phosphor-icons/react"
import type { Constraint } from "@/core/types/types"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { InlineEdit } from "@/components/ui/inline-edit"
import { DetailPanel, Field } from "@/features/repository/ElementTree"

/**
 * Editable detail panel for a MIG-specific (additional) constraint
 * (FUNCTIONALITY §5.7): inline-edit name and definition. The name stays unique
 * within the element — a rename that is blank, unchanged, or already taken by a
 * sibling constraint is rejected (the field reverts). Standard, spec-inherited
 * constraints use the read-only view instead.
 */
export function MigConstraintDetail({
  constraint,
  path,
  takenNames,
  onRename,
  onSetDefinition,
  onDelete,
}: {
  constraint: Constraint
  /** Full xmlPath of the constraint (for display). */
  path: string
  /** Sibling constraint names (standard + other additional), excluding this one. */
  takenNames: string[]
  onRename: (name: string) => void
  onSetDefinition: (definition: string) => void
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
