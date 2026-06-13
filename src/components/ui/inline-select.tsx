import { useState, type KeyboardEvent } from "react"
import { PencilSimpleIcon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

export type SelectOption = { value: string; label: string }

/**
 * Inline-edit dropdown — the select counterpart to {@link InlineEdit}. Shows the
 * selected option's label with a pencil button (on hover/focus); clicking it
 * reveals the `<select>`. Picking an option commits and returns to the label;
 * Esc or blur closes without committing. An empty value reads as `<none>`.
 */
export function InlineSelect({
  value,
  options,
  onCommit,
  ariaLabel,
}: {
  value: string
  options: SelectOption[]
  onCommit: (next: string) => void
  ariaLabel: string
}) {
  const [editing, setEditing] = useState(false)

  if (!editing) {
    const label = options.find((o) => o.value === value)?.label ?? value
    return (
      <div className="group flex w-full items-start justify-between gap-2 rounded-md border border-transparent px-2 py-1 transition-colors hover:border-border focus-within:border-border">
        <span className={cn("min-w-0 text-sm", !value && "text-muted-foreground italic")}>
          {value ? label : "<none>"}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Edit ${ariaLabel}`}
          className="mt-0.5 shrink-0 rounded-sm p-0.5 text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <PencilSimpleIcon className="size-3.5" aria-hidden />
        </button>
      </div>
    )
  }

  const onKeyDown = (e: KeyboardEvent<HTMLSelectElement>) => {
    if (e.key === "Escape") {
      e.preventDefault()
      setEditing(false)
    }
  }

  return (
    <select
      autoFocus
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => {
        setEditing(false)
        if (e.target.value !== value) onCommit(e.target.value)
      }}
      onBlur={() => setEditing(false)}
      onKeyDown={onKeyDown}
      className="h-8 w-full rounded-md border border-border bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
