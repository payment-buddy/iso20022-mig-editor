import { useEffect, useRef, useState, type ComponentType } from "react"
import { CaretDownIcon, ExportIcon, FileTextIcon, TableIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"

/**
 * Header "Export" menu grouping the secondary report exports (Markdown, CSV). A
 * hand-rolled popover (no dropdown-library dependency): closes on select, Escape,
 * or an outside click; ↑/↓/Home/End move between items.
 */
export function ExportMenu({ onMarkdown, onCsv }: { onMarkdown: () => void; onCsv: () => void }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
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
    if (open) menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
  }, [open])

  const select = (run: () => void) => {
    setOpen(false)
    run()
  }

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    const to =
      e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : null
    if (to === null) return
    e.preventDefault()
    items[Math.max(0, Math.min(items.length - 1, to))]?.focus()
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="outline"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <ExportIcon data-icon="inline-start" aria-hidden />
        Export
        <CaretDownIcon className="ml-1 size-3.5 opacity-60" aria-hidden />
      </Button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Export"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 z-50 mt-1 min-w-36 rounded-md border border-border bg-background p-1 shadow-lg outline-none"
        >
          <MenuItem icon={FileTextIcon} label="Markdown" onSelect={() => select(onMarkdown)} />
          <MenuItem icon={TableIcon} label="CSV" onSelect={() => select(onCsv)} />
        </div>
      )}
    </div>
  )
}

function MenuItem({
  icon: Icon,
  label,
  onSelect,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  label: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onSelect}
      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus:bg-muted"
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  )
}
