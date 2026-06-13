import { useState, type KeyboardEvent } from "react"
import { PencilSimple, Warning, X } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

// Keep focus on the input when a button is clicked, so edit mode survives (blur
// out of the widget is what exits it). preventDefault on mousedown stops the
// button from stealing focus.
const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault()

/**
 * A list of string values that reads like the inline-edit fields around it: a
 * read-only view (chips, or a placeholder when empty) with a pencil button, and
 * an edit mode (removable chips + an input to append) entered by clicking it.
 * Whole-list changes are reported via `onChange`; duplicate and blank entries are
 * ignored. Edit mode exits on click-away or Esc. `validate` returns an advisory
 * error for a value (or `null`); offending entries are flagged, not blocked.
 */
export function EditableList({
  values,
  onChange,
  ariaLabel,
  placeholder = "Add value…",
  validate,
}: {
  values: string[]
  onChange: (next: string[]) => void
  ariaLabel: string
  placeholder?: string
  validate?: (value: string) => string | null
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const draftError = validate && draft.trim() ? validate(draft.trim()) : null

  const add = () => {
    const value = draft.trim()
    if (value && !values.includes(value)) onChange([...values, value])
    setDraft("")
  }

  const remove = (index: number) => onChange(values.filter((_, i) => i !== index))

  // Chips list (shared by view/edit); `removable` adds the per-chip delete button.
  const chips = (removable: boolean) =>
    values.length > 0 ? (
      <ul aria-label={ariaLabel} className="flex max-h-40 flex-wrap gap-1 overflow-auto">
        {values.map((value, i) => {
          const error = validate ? validate(value) : null
          return (
            <li key={`${value}-${i}`}>
              <span
                title={error ?? undefined}
                className={cn(
                  "inline-flex items-center gap-1 rounded-sm py-0.5 text-xs",
                  removable ? "pr-0.5 pl-1.5" : "px-1.5",
                  error ? "bg-amber-500/10 text-amber-700 dark:text-amber-500" : "bg-muted",
                )}
              >
                {error && <Warning className="size-3 shrink-0" aria-hidden />}
                <code>{value}</code>
                {removable && (
                  <button
                    type="button"
                    onMouseDown={keepFocus}
                    onClick={() => remove(i)}
                    aria-label={`Remove ${value}`}
                    className="rounded-sm p-0.5 text-current/70 outline-none hover:bg-muted-foreground/10 hover:text-current focus-visible:ring-2 focus-visible:ring-ring/30"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    ) : null

  if (!editing) {
    return (
      <div className="group flex w-full items-start justify-between gap-2 rounded-md border border-transparent px-2 py-1 transition-colors hover:border-border focus-within:border-border">
        <div className="min-w-0">
          {/* Empty optional list reads as "<none>", not the "Add…" input hint. */}
          {chips(false) ?? <span className="text-sm text-muted-foreground italic">{"<none>"}</span>}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Edit ${ariaLabel}`}
          className="mt-0.5 shrink-0 rounded-sm p-0.5 text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <PencilSimple className="size-3.5" aria-hidden />
        </button>
      </div>
    )
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      add()
    } else if (e.key === "Escape") {
      e.preventDefault()
      setDraft("")
      setEditing(false)
    }
  }

  return (
    <div
      className="flex flex-col gap-1.5"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setDraft("")
          setEditing(false)
        }
      }}
    >
      {chips(true)}
      <div className="flex gap-1.5">
        <input
          type="text"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={`Add to ${ariaLabel}`}
          className="h-7 flex-1 rounded-md border border-border bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        <button
          type="button"
          onMouseDown={keepFocus}
          onClick={add}
          className="rounded-md border border-border px-2 text-xs text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          Add
        </button>
      </div>
      {draftError && (
        <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
          <Warning className="size-3 shrink-0" aria-hidden />
          {draftError}
        </p>
      )}
    </div>
  )
}
