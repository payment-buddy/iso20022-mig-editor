import { useEffect, useRef, useState, type ComponentType } from "react"
import { DotsThreeVerticalIcon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

export type DotsMenuItem = {
  label: string
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  onSelect: () => void
  /** Render in the destructive colour (e.g. a Delete action). */
  destructive?: boolean
}

/**
 * A "kebab" (three-dots) overflow menu: an icon trigger plus a popover of
 * actions. Hand-rolled popover (no dropdown-library dependency), matching
 * `ExportMenu`: closes on select, Escape, or an outside click; ↑/↓/Home/End move
 * between items, and focus returns to the trigger on close.
 */
export function DotsMenu({
  label,
  items,
}: {
  /** Accessible name for the trigger and the menu (e.g. "Constraint actions"). */
  label: string
  items: DotsMenuItem[]
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const focusTrigger = () =>
    rootRef.current
      ?.querySelector<HTMLButtonElement>("button[aria-haspopup]")
      ?.focus()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        focusTrigger()
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  // Focus the first item when the menu opens (keyboard-first).
  useEffect(() => {
    if (open)
      menuRef.current
        ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
        ?.focus()
  }, [open])

  const select = (run: () => void) => {
    setOpen(false)
    focusTrigger()
    run()
  }

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const els = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]'
      ) ?? []
    )
    const i = els.indexOf(document.activeElement as HTMLButtonElement)
    const to =
      e.key === "ArrowDown"
        ? i + 1
        : e.key === "ArrowUp"
          ? i - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? els.length - 1
              : null
    if (to === null) return
    e.preventDefault()
    els[Math.max(0, Math.min(els.length - 1, to))]?.focus()
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className="flex size-7 items-center justify-center rounded-sm border border-border bg-muted text-foreground outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/30 aria-expanded:bg-muted/60"
      >
        <DotsThreeVerticalIcon className="size-5" aria-hidden weight="bold" />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 z-50 mt-1 min-w-32 rounded-md border border-border bg-background p-1 shadow-lg outline-none"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => select(item.onSelect)}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus:bg-muted",
                item.destructive && "text-destructive"
              )}
            >
              {item.icon && <item.icon className="size-4" aria-hidden />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
