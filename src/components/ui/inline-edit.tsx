import { useState, type KeyboardEvent } from "react"
import { PencilSimple } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

/**
 * Click-to-edit text field (FUNCTIONALITY §10 inline-edit model): shows the
 * value until Click/Enter, then an input/textarea. Commits on blur, cancels on
 * Esc; single-line also commits on Enter (multiline keeps Enter for newlines).
 */
export function InlineEdit({
  value,
  onCommit,
  ariaLabel,
  placeholder = "—",
  multiline = false,
}: {
  value: string
  onCommit: (next: string) => void
  ariaLabel: string
  placeholder?: string
  multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const start = () => {
    setDraft(value)
    setEditing(true)
  }
  const commit = () => {
    setEditing(false)
    if (draft !== value) onCommit(draft)
  }
  const cancel = () => {
    setEditing(false)
    setDraft(value)
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={start}
        aria-label={`Edit ${ariaLabel}`}
        className="group flex w-full items-start justify-between gap-2 rounded-md px-2 py-1 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <span className={cn("whitespace-pre-wrap", !value && "text-muted-foreground italic")}>
          {value || placeholder}
        </span>
        <PencilSimple
          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        />
      </button>
    )
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault()
      cancel()
    } else if (e.key === "Enter" && !multiline) {
      e.preventDefault()
      commit()
    }
  }

  const className =
    "w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"

  return multiline ? (
    <textarea
      autoFocus
      rows={3}
      value={draft}
      aria-label={ariaLabel}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className={cn(className, "resize-y")}
    />
  ) : (
    <input
      type="text"
      autoFocus
      value={draft}
      aria-label={ariaLabel}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className={cn(className, "h-8")}
    />
  )
}
