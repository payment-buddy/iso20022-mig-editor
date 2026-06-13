import { useState, type KeyboardEvent, type ReactNode } from "react"
import { PencilSimpleIcon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

// A value longer than this (or spanning many lines) is collapsed to a few lines
// behind a "Show more" toggle. Heuristic — avoids measuring the DOM in an effect.
const LONG_TEXT_CHARS = 300
const isLongText = (s: string) => s.length > LONG_TEXT_CHARS || s.split("\n").length > 5

/**
 * Inline-edit text field (FUNCTIONALITY §10 inline-edit model). The value is
 * plain text with a pencil button that appears on hover/focus; clicking it
 * switches to an input/textarea (an explicit affordance, so the field can't be
 * edited by accident). Commits on blur, cancels on Esc; single-line also commits
 * on Enter (multiline keeps Enter for newlines).
 *
 * An empty value reads as `<none>` (optional fields aren't a to-do); `placeholder`
 * is only the hint shown inside the editor while typing.
 *
 * `type="number"` renders a numeric input with the browser's increment/decrement
 * spinner. `display` overrides the non-editing label when it should differ from
 * the raw value (e.g. an empty number field shown as "unbounded").
 */
export function InlineEdit({
  value,
  onCommit,
  ariaLabel,
  placeholder = "—",
  multiline = false,
  type = "text",
  display,
}: {
  value: string
  onCommit: (next: string) => void
  ariaLabel: string
  placeholder?: string
  multiline?: boolean
  type?: "text" | "number"
  display?: ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [expanded, setExpanded] = useState(false)

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
    const showPlaceholder = display == null && !value
    const collapsible = display == null && isLongText(value)
    return (
      <div className="group flex w-full items-start justify-between gap-2 rounded-md border border-transparent px-2 py-1 transition-colors hover:border-border focus-within:border-border">
        <div className="min-w-0 text-sm">
          {collapsible ? (
            <>
              <p className={cn("whitespace-pre-wrap", !expanded && "line-clamp-5")}>{value}</p>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-0.5 rounded-sm text-xs text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            </>
          ) : (
            <span
              className={cn("whitespace-pre-wrap", showPlaceholder && "text-muted-foreground italic")}
            >
              {/* Empty optional value reads as "<none>", not the "Add…" input hint. */}
              {display ?? (value || "<none>")}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={start}
          aria-label={`Edit ${ariaLabel}`}
          className="mt-0.5 shrink-0 rounded-sm p-0.5 text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <PencilSimpleIcon className="size-3.5" aria-hidden />
        </button>
      </div>
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
      rows={6}
      value={draft}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className={cn(className, "resize-y")}
    />
  ) : (
    <input
      type={type === "number" ? "number" : "text"}
      inputMode={type === "number" ? "numeric" : undefined}
      min={type === "number" ? 0 : undefined}
      step={type === "number" ? "any" : undefined}
      autoFocus
      value={draft}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className={cn(className, "h-8")}
    />
  )
}
