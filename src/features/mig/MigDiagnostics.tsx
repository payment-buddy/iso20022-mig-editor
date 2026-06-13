import { useState } from "react"
import { CaretRight, Warning } from "@phosphor-icons/react"
import type { Diagnostic } from "@/core/mig/validateMig"
import { cn } from "@/lib/utils"

/**
 * Advisory consistency banner (FUNCTIONALITY §5.7): "This MIG has N issues",
 * expanding to a drawer that lists each loosening/consistency diagnostic
 * (element, field, message, path). Renders nothing when the MIG is clean.
 */
export function MigDiagnostics({ diagnostics }: { diagnostics: Diagnostic[] }) {
  const [open, setOpen] = useState(false)
  if (diagnostics.length === 0) return null

  const n = diagnostics.length
  return (
    <section
      aria-label="Consistency diagnostics"
      className="rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-500"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <Warning className="size-4 shrink-0" aria-hidden />
        This MIG has {n} {n === 1 ? "issue" : "issues"}
        <CaretRight className={cn("ml-auto size-3.5 transition-transform", open && "rotate-90")} aria-hidden />
      </button>

      {open && (
        <ul aria-label="Diagnostics" className="flex flex-col gap-1.5 border-t border-amber-500/30 px-3 py-2">
          {diagnostics.map((d, i) => (
            <li key={`${d.path}-${d.field}-${i}`} className="text-xs">
              <span className="font-medium">{d.elementName}</span>
              <span className="text-amber-700/70 dark:text-amber-500/70"> · {d.field}</span>
              <p className="text-amber-700/90 dark:text-amber-500/90">{d.message}</p>
              <code className="text-[0.625rem] text-amber-700/60 dark:text-amber-500/60">{d.path}</code>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
