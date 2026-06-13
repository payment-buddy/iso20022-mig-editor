import { useEffect, useRef, useState } from "react"
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowLineLeft,
  ArrowLineRight,
  FloppyDisk,
  GitDiff,
  Warning,
} from "@phosphor-icons/react"
import { resolveMessage } from "@/core/erepository/resolveMessage"
import { buildPathOrder } from "@/core/mig/serializeMig"
import { applyFieldCopy } from "@/core/mig/copyChange"
import { compareMigs, type FieldChange, type FieldRef, type PathDiff } from "@/core/mig/compareMigs"
import { loadMig, saveMig } from "@/core/storage/migStore"
import type { ERepository, MessageImplementationGuide } from "@/core/types/types"
import { hashFor } from "@/app/routes"
import { Button } from "@/components/ui/button"

type Loaded = {
  a: MessageImplementationGuide | null
  b: MessageImplementationGuide | null
}

type CopyDir = "a-to-b" | "b-to-a"
type CopyFn = (path: string, ref: FieldRef, dir: CopyDir) => void

// Shared 3-column template so the A/B headers line up with the field rows; the
// middle column is the gutter that holds the copy buttons.
const COLS = "grid grid-cols-[minmax(0,1fr)_3.25rem_minmax(0,1fr)]"

/**
 * Compare two MIGs (FUNCTIONALITY §5.8). Loads both by key, resolves the message
 * for schema-order alignment, and renders a side-by-side diff of their *declared*
 * overrides — showing only elements (and fields) that differ. Each field can be
 * copied across to the other MIG (hover-revealed buttons); the copy persists and
 * the now-matching field drops out of the diff. Keyboard: j/k or ↑/↓ step between
 * changed elements.
 */
export function MigCompare({ keyA, keyB, repo }: { keyA: string; keyB: string; repo: ERepository }) {
  const [status, setStatus] = useState<"loading" | "ready">("loading")
  // `saved` mirrors what's in storage; `draft` holds the in-progress copies.
  // Edits go to the draft and only persist on Save (reference-equal until then).
  const [saved, setSaved] = useState<Loaded>({ a: null, b: null })
  const [draft, setDraft] = useState<Loaded>({ a: null, b: null })

  useEffect(() => {
    let active = true
    Promise.all([loadMig(keyA), loadMig(keyB)])
      .then(([a, b]) => {
        if (!active) return
        setSaved({ a, b })
        setDraft({ a, b })
        setStatus("ready")
      })
      .catch((err) => {
        console.error("Failed to load MIGs for compare:", err)
        if (active) setStatus("ready")
      })
    return () => {
      active = false
    }
  }, [keyA, keyB])

  if (status === "loading") return <Notice title="Loading…" />

  const { a, b } = draft
  if (!a || !b) {
    const missing = [!a && keyA, !b && keyB].filter(Boolean) as string[]
    return (
      <Notice title="MIG not found">
        Couldn’t load {missing.map((k) => `“${k}”`).join(" and ")}. They may have been deleted.
        Return to <Home /> to see your MIGs.
      </Notice>
    )
  }

  // Schema order from whichever MIG's message resolves (same when they match).
  const resolved =
    resolveMessage(repo, a.messageIdentifier) ?? resolveMessage(repo, b.messageIdentifier)
  const order = resolved ? buildPathOrder(resolved.current.rootElement) : undefined

  const diff = compareMigs(a, b, order)

  // Copy one field from one MIG into the other — applied to the draft only. The
  // edited field then matches and drops out of the recomputed diff; persistence
  // waits for Save.
  const copy: CopyFn = (path, ref, dir) => {
    const [from, to] = dir === "a-to-b" ? [a, b] : [b, a]
    const next = applyFieldCopy(from, to, path, ref)
    setDraft(dir === "a-to-b" ? { a, b: next } : { a: next, b })
  }

  // Reference inequality is enough: only applyFieldCopy produces new objects.
  const dirty = draft.a !== saved.a || draft.b !== saved.b

  const save = () => {
    const writes: Promise<void>[] = []
    if (draft.a && draft.a !== saved.a) writes.push(saveMig(draft.a))
    if (draft.b && draft.b !== saved.b) writes.push(saveMig(draft.b))
    Promise.all(writes)
      .then(() => setSaved(draft))
      .catch((err) => console.error("Failed to save MIGs:", err))
  }

  const discard = () => setDraft(saved)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitDiff className="size-3.5" aria-hidden />
            Compare MIGs
          </p>
          <h1 className="text-base font-semibold tracking-tight">
            {diff.a.name} <span className="text-muted-foreground">{diff.a.version}</span>{" "}
            <span className="text-muted-foreground">↔</span> {diff.b.name}{" "}
            <span className="text-muted-foreground">{diff.b.version}</span>
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {dirty && (
            <span className="text-xs text-amber-700 dark:text-amber-500" aria-live="polite">
              Unsaved changes
            </span>
          )}
          {dirty && (
            <Button variant="outline" size="sm" onClick={discard}>
              <ArrowCounterClockwise data-icon="inline-start" aria-hidden />
              Discard
            </Button>
          )}
          <Button size="sm" disabled={!dirty} onClick={save}>
            <FloppyDisk data-icon="inline-start" aria-hidden />
            Save
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={hashFor({ name: "home" })}>
              <ArrowLeft data-icon="inline-start" aria-hidden />
              Back
            </a>
          </Button>
        </div>
      </div>

      {!diff.sameMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-500"
        >
          <Warning className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            These MIGs target different messages (<code>{a.messageIdentifier}</code> vs{" "}
            <code>{b.messageIdentifier}</code>). Paths are compared by name only.
          </p>
        </div>
      )}

      {diff.paths.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          These two MIGs have identical overrides — nothing to compare.
        </p>
      ) : (
        <ComparePanel diff={diff} copy={copy} />
      )}
    </div>
  )
}

function ComparePanel({
  diff,
  copy,
}: {
  diff: ReturnType<typeof compareMigs>
  copy: CopyFn
}) {
  const cardRefs = useRef<(HTMLElement | null)[]>([])

  // j/k and ↑/↓ step focus between changed elements.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const dir = e.key === "j" || e.key === "ArrowDown" ? 1 : e.key === "k" || e.key === "ArrowUp" ? -1 : 0
    if (dir === 0) return
    e.preventDefault()
    const cards = cardRefs.current.filter(Boolean) as HTMLElement[]
    const active = document.activeElement
    const at = cards.findIndex((c) => c === active)
    const next = cards[Math.max(0, Math.min(cards.length - 1, (at < 0 ? -1 : at) + dir))]
    next?.focus()
    next?.scrollIntoView({ block: "nearest" })
  }

  const aLabel = `${diff.a.name} ${diff.a.version}`
  const bLabel = `${diff.b.name} ${diff.b.version}`

  return (
    <div className="flex flex-col gap-3" onKeyDown={onKeyDown}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span aria-live="polite">
          {diff.paths.length === 1
            ? "1 element differs"
            : `${diff.paths.length} elements differ`}
        </span>
        <span className="hidden sm:inline">
          <kbd className="rounded border px-1">j</kbd>/<kbd className="rounded border px-1">k</kbd>{" "}
          to step · hover a row to copy across
        </span>
      </div>

      {/* Column headers: MIG A (left) vs MIG B (right), aligned with field rows. */}
      <div className={`${COLS} overflow-hidden rounded-t-md border border-b-0 text-xs font-medium`}>
        <div className="truncate px-3 py-1.5">
          {diff.a.name} <span className="text-muted-foreground">{diff.a.version}</span>
        </div>
        <div className="border-x bg-muted/20" />
        <div className="truncate px-3 py-1.5">
          {diff.b.name} <span className="text-muted-foreground">{diff.b.version}</span>
        </div>
      </div>

      <div className="-mt-3 flex flex-col">
        {diff.paths.map((p, i) => (
          <ElementCard
            key={p.path}
            diff={p}
            copy={copy}
            aLabel={aLabel}
            bLabel={bLabel}
            ref={(el) => {
              cardRefs.current[i] = el
            }}
          />
        ))}
      </div>
    </div>
  )
}

const KIND_BADGE: Record<PathDiff["kind"], { label: string; className: string }> = {
  added: { label: "only in B", className: "text-emerald-700 dark:text-emerald-400" },
  removed: { label: "only in A", className: "text-destructive" },
  changed: { label: "changed", className: "text-amber-700 dark:text-amber-500" },
}

function ElementCard({
  diff,
  copy,
  aLabel,
  bLabel,
  ref,
}: {
  diff: PathDiff
  copy: CopyFn
  aLabel: string
  bLabel: string
  ref: (el: HTMLElement | null) => void
}) {
  const badge = KIND_BADGE[diff.kind]
  return (
    <section
      ref={ref}
      tabIndex={0}
      aria-label={`${diff.name} — ${badge.label}`}
      className="border border-t-0 outline-none first:border-t-0 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset"
    >
      <header className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5">
        <span className="font-medium">{diff.name}</span>
        <code className="truncate text-xs text-muted-foreground">{diff.path}</code>
        <span className={`ml-auto shrink-0 text-xs font-medium ${badge.className}`}>
          {badge.label}
        </span>
      </header>
      <div className="flex flex-col divide-y">
        {diff.fields.map((f) => (
          <FieldRow
            key={f.label}
            field={f}
            onCopy={(dir) => copy(diff.path, f.ref, dir)}
            aLabel={aLabel}
            bLabel={bLabel}
          />
        ))}
      </div>
    </section>
  )
}

/** One field across both columns, with a hover-revealed copy gutter between them. */
function FieldRow({
  field,
  onCopy,
  aLabel,
  bLabel,
}: {
  field: FieldChange
  onCopy: (dir: CopyDir) => void
  aLabel: string
  bLabel: string
}) {
  return (
    <div className={`group ${COLS}`}>
      <Cell label={field.label} value={field.a} side="a" kind={field.kind} />
      <div className="flex items-center justify-center gap-0.5 border-x bg-muted/10 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <CopyButton
          dir="right"
          label={`Copy ${field.label} to ${bLabel}`}
          onClick={() => onCopy("a-to-b")}
        />
        <CopyButton
          dir="left"
          label={`Copy ${field.label} to ${aLabel}`}
          onClick={() => onCopy("b-to-a")}
        />
      </div>
      <Cell label={field.label} value={field.b} side="b" kind={field.kind} />
    </div>
  )
}

function CopyButton({
  dir,
  label,
  onClick,
}: {
  dir: "left" | "right"
  label: string
  onClick: () => void
}) {
  const Icon = dir === "right" ? ArrowLineRight : ArrowLineLeft
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded p-0.5 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <Icon className="size-3.5" aria-hidden />
    </button>
  )
}

function Cell({
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
  // Tint the side that carries the change: removed → left (A), added → right (B),
  // changed → both. A `null` value means this MIG doesn't set the field.
  const tinted =
    kind === "changed" || (kind === "removed" && side === "a") || (kind === "added" && side === "b")
  const tint =
    !tinted || value === null
      ? ""
      : kind === "added"
        ? "bg-emerald-500/10"
        : kind === "removed"
          ? "bg-destructive/10"
          : "bg-amber-500/10"

  return (
    <div className={`px-3 py-1.5 text-sm ${tint}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="break-words">
        {value === null ? (
          <span className="italic text-muted-foreground/70">inherits</span>
        ) : (
          value
        )}
      </div>
    </div>
  )
}

function Notice({ title, children }: { title: string; children?: React.ReactNode }) {
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
