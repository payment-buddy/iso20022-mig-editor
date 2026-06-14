import type {FieldChange} from "@/core/mig/compareMigs"
import {hashFor} from "@/app/routes"

/**
 * Presentation leaves shared by the Compare and Merge screens. These are the
 * pieces that were identical in both; the screens still own their own
 * top-level behaviour (two-way copy vs. one-way take, upload, revisions).
 */

// Shared 3-column template so the two side headers line up with the field rows;
// the middle column is the gutter that holds the copy/take buttons.
export const COLS = "grid grid-cols-[minmax(0,1fr)_3.25rem_minmax(0,1fr)]"

/**
 * One side's value in a diff row, tinted by the kind of change it carries. The
 * left column is side `"a"`, the right is `"b"` (Compare: MIG A / MIG B; Merge:
 * current / incoming). Tint the side that carries the change: removed → red on
 * `a`, added → green on `b`, changed → blue on both. A `null` value means that
 * MIG doesn't set the field.
 */
export function Cell({
  label,
  value,
  side,
  kind,
}: {
  label: string
  value: string | null
  side: "a" | "b"
  kind: FieldChange["kind"]
}) {
  const tinted =
    kind === "changed" || (kind === "removed" && side === "a") || (kind === "added" && side === "b")
  const tint =
    !tinted || value === null
      ? ""
      : kind === "added"
        ? "bg-emerald-500/10"
        : kind === "removed"
          ? "bg-red-500/10"
          : "bg-blue-500/10"
  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 px-3 py-1.5 text-sm ${tint}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words">
        {value === null ? (
          <span className="italic text-muted-foreground/70">inherits</span>
        ) : (
          value
        )}
      </span>
    </div>
  )
}

/** Full-screen status message (loading / not-found) used before the diff renders. */
export function Notice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-2 p-6 xl:max-w-4xl">
      <h1 className="text-base font-semibold tracking-tight">{title}</h1>
      {children && <p className="text-sm text-muted-foreground">{children}</p>}
    </div>
  )
}

/** Inline link back to the home screen, for use inside a {@link Notice}. */
export function Home() {
  return (
    <a href={hashFor({ name: "home" })} className="text-primary underline-offset-4 hover:underline">
      Home
    </a>
  )
}
