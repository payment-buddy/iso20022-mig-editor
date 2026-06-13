import { useState, type KeyboardEvent } from "react"
import { X } from "@phosphor-icons/react"

/**
 * A simple editable list of string values: removable chips plus an input to
 * append. Whole-list changes are reported via `onChange`. Duplicates and blank
 * entries are ignored; `validate` can reject further additions.
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
  validate?: (value: string) => boolean
}) {
  const [draft, setDraft] = useState("")

  const add = () => {
    const value = draft.trim()
    if (!value || values.includes(value) || (validate && !validate(value))) {
      setDraft("")
      return
    }
    onChange([...values, value])
    setDraft("")
  }

  const remove = (index: number) => onChange(values.filter((_, i) => i !== index))

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      add()
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {values.length > 0 && (
        <ul aria-label={ariaLabel} className="flex max-h-40 flex-wrap gap-1 overflow-auto">
          {values.map((value, i) => (
            <li key={`${value}-${i}`}>
              <span className="inline-flex items-center gap-1 rounded-sm bg-muted py-0.5 pr-0.5 pl-1.5 text-xs">
                <code>{value}</code>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Remove ${value}`}
                  className="rounded-sm p-0.5 text-muted-foreground outline-none hover:bg-muted-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={`Add to ${ariaLabel}`}
          className="h-7 flex-1 rounded-md border border-border bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-md border border-border px-2 text-xs text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          Add
        </button>
      </div>
    </div>
  )
}
