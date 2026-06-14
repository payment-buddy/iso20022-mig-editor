import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  ClockCounterClockwiseIcon,
} from "@phosphor-icons/react"
import { compareMigs, type MigComparison } from "@/core/mig/compareMigs"
import { appendRevision, type Revision } from "@/core/mig/revisions"
import { resolveMessage } from "@/core/erepository/resolveMessage"
import { buildPathOrder } from "@/core/mig/serializeMig"
import { loadMig, saveMig } from "@/core/storage/migStore"
import { loadRevisions, saveRevisions } from "@/core/storage/revisionStore"
import type { ERepository, MessageImplementationGuide } from "@/core/types/types"
import { hashFor, navigate } from "@/app/routes"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { cn } from "@/lib/utils"
import { formatLocalDateTime } from "@/lib/datetime"

/**
 * Revision history for one MIG (IMPLEMENTATION_PLAN Phase 2). Lists the MIG's
 * auto-saved revisions (newest first); selecting one shows the semantic diff of
 * that revision vs the current state (what reverting would undo) via
 * `compareMigs`. Revert restores the revision's document content under the
 * current identity, records a "Reverted" revision, and returns to the editor.
 */
export function MigHistory({ migKey, repo }: { migKey: string; repo: ERepository }) {
  const [status, setStatus] = useState<"loading" | "ready">("loading")
  const [mig, setMig] = useState<MessageImplementationGuide | null>(null)
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [revertTarget, setRevertTarget] = useState<Revision | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([loadMig(migKey), loadRevisions(migKey)])
      .then(([m, revs]) => {
        if (!active) return
        setMig(m)
        setRevisions(revs)
        setSelectedId(revs.length > 0 ? revs[revs.length - 1].id : null)
        setStatus("ready")
      })
      .catch((err) => {
        console.error("Failed to load history:", err)
        if (active) setStatus("ready")
      })
    return () => {
      active = false
    }
  }, [migKey])

  // Schema (document) order for the diff — resolve the MIG's message once.
  const order = useMemo(() => {
    if (!mig) return undefined
    const message = resolveMessage(repo, mig.messageIdentifier)?.current
    return message ? buildPathOrder(message.rootElement) : undefined
  }, [repo, mig])

  if (status === "loading") return <Notice title="Loading…" />
  if (!mig) {
    return (
      <Notice title="MIG not found">
        No MIG is stored under “{migKey}”. Return to <Home /> to see your MIGs.
      </Notice>
    )
  }

  const ordered = [...revisions].reverse() // newest first
  // Diff a revision against its predecessor — i.e. what *changed at* that
  // revision (a merge, an edit burst, a revert). The oldest revision has no
  // predecessor, so it's the initial snapshot.
  const selectedIndex = revisions.findIndex((r) => r.id === selectedId)
  const selected = selectedIndex >= 0 ? revisions[selectedIndex] : null
  const previous = selectedIndex > 0 ? revisions[selectedIndex - 1] : null
  const diff = selected && previous ? compareMigs(previous.mig, selected.mig, order) : null

  const revert = async (rev: Revision) => {
    // Restore the revision's content but keep the current identity (no re-key).
    const restored: MessageImplementationGuide = { ...rev.mig, name: mig.name, version: mig.version }
    await saveMig(restored)
    await saveRevisions(migKey, appendRevision(revisions, restored, Date.now(), "Reverted"))
    navigate({ name: "mig", key: migKey })
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <div className="space-y-0.5">
        <p className="flex items-center gap-1.5 text-[0.625rem] font-medium tracking-wide text-muted-foreground uppercase">
          <ClockCounterClockwiseIcon className="size-3.5" aria-hidden />
          Revision history
        </p>
        <h1 className="text-base font-semibold tracking-tight">{mig.name}</h1>
        <a
          href={hashFor({ name: "mig", key: migKey })}
          className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeftIcon className="size-3" aria-hidden />
          Back to editor
        </a>
      </div>

      {revisions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No revisions yet — edits you make in the editor are snapshotted here automatically.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,18rem)_1fr]">
          <ul aria-label="Revisions" className="flex flex-col gap-1">
            {ordered.map((rev) => (
              <li key={rev.id}>
                <RevisionRow
                  rev={rev}
                  selected={rev.id === selectedId}
                  onSelect={() => setSelectedId(rev.id)}
                  onRevert={() => setRevertTarget(rev)}
                />
              </li>
            ))}
          </ul>
          <div className="min-w-0">
            {diff ? (
              <DiffView diff={diff} />
            ) : selected && !previous ? (
              <p className="text-sm text-muted-foreground">
                Initial snapshot — there's no earlier revision to compare against.
              </p>
            ) : null}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={revertTarget !== null}
        onOpenChange={(open) => !open && setRevertTarget(null)}
        title="Revert to this revision?"
        description="This replaces the current MIG content with the selected revision. It's recorded as a new revision, so you can revert again."
        confirmLabel="Revert"
        onConfirm={() => revertTarget && revert(revertTarget)}
      />
    </div>
  )
}

function RevisionRow({
  rev,
  selected,
  onSelect,
  onRevert,
}: {
  rev: Revision
  selected: boolean
  onSelect: () => void
  onRevert: () => void
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2",
        selected ? "border-border bg-muted/60" : "border-transparent hover:bg-muted/40",
      )}
    >
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left outline-none">
        <div className="text-xs font-medium">{formatLocalDateTime(rev.at)}</div>
        <div className="truncate text-xs text-muted-foreground">{rev.summary}</div>
      </button>
      <button
        type="button"
        onClick={onRevert}
        className="flex shrink-0 items-center gap-1 rounded-sm text-[0.625rem] text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <ArrowCounterClockwiseIcon className="size-3" aria-hidden />
        Revert
      </button>
    </div>
  )
}

/** Read-only diff of a revision vs its predecessor — the before (left) / after
 *  (right) of what changed at that revision. */
function DiffView({ diff }: { diff: MigComparison }) {
  if (diff.paths.length === 0) {
    return <p className="text-sm text-muted-foreground">No changes in this revision.</p>
  }
  const value = (v: string | null) =>
    v === null ? <span className="text-muted-foreground/70 italic">inherits</span> : v
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 px-3 text-[0.625rem] tracking-wide text-muted-foreground uppercase">
        <span>Before</span>
        <span>This revision</span>
      </div>
      {diff.paths.map((p) => (
        <section key={p.path} className="rounded-md border border-border">
          <header className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-1.5">
            <span className="font-medium">{p.name}</span>
            <code className="truncate text-xs text-muted-foreground">{p.path}</code>
          </header>
          <div className="flex flex-col divide-y divide-border">
            {p.fields.map((f) => (
              <div key={f.label} className="px-3 py-1.5">
                <div className="text-xs text-muted-foreground">{f.label}</div>
                <div className="grid grid-cols-2 gap-3 text-sm break-words">
                  <div>{value(f.a)}</div>
                  <div>{value(f.b)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function Notice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-2 p-6">
      <h1 className="text-base font-semibold tracking-tight">{title}</h1>
      {children && <p className="text-sm text-muted-foreground">{children}</p>}
    </div>
  )
}

function Home() {
  return (
    <a href={hashFor({ name: "home" })} className="text-primary underline-offset-4 hover:underline">
      Home
    </a>
  )
}
