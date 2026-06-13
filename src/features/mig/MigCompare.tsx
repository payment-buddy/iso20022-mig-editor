import { useEffect, useRef, useState } from "react"
import { ArrowLeft, GitDiff, Warning } from "@phosphor-icons/react"
import { resolveMessage } from "@/core/erepository/resolveMessage"
import { buildPathOrder } from "@/core/mig/serializeMig"
import { compareMigs, type FieldChange, type PathDiff } from "@/core/mig/compareMigs"
import { loadMig } from "@/core/storage/migStore"
import type { ERepository, MessageImplementationGuide } from "@/core/types/types"
import { hashFor } from "@/app/routes"
import { Button } from "@/components/ui/button"

type Loaded = {
  a: MessageImplementationGuide | null
  b: MessageImplementationGuide | null
}

/**
 * Compare two MIGs (FUNCTIONALITY §5.8). Loads both by key, resolves the message
 * for schema-order alignment, and renders a side-by-side diff of their *declared*
 * overrides — showing only elements (and fields) that differ. Keyboard: j/k or
 * ↑/↓ step between changed elements.
 */
export function MigCompare({ keyA, keyB, repo }: { keyA: string; keyB: string; repo: ERepository }) {
  const [status, setStatus] = useState<"loading" | "ready">("loading")
  const [loaded, setLoaded] = useState<Loaded>({ a: null, b: null })

  useEffect(() => {
    let active = true
    Promise.all([loadMig(keyA), loadMig(keyB)])
      .then(([a, b]) => {
        if (!active) return
        setLoaded({ a, b })
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

  const { a, b } = loaded
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
        <Button variant="outline" size="sm" asChild>
          <a href={hashFor({ name: "home" })}>
            <ArrowLeft data-icon="inline-start" aria-hidden />
            Back
          </a>
        </Button>
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
        <ComparePanel diff={diff} />
      )}
    </div>
  )
}

function ComparePanel({ diff }: { diff: ReturnType<typeof compareMigs> }) {
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
          to step between changes
        </span>
      </div>

      {/* Column headers: MIG A (left) vs MIG B (right). */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-t-md border border-b-0 bg-border text-xs font-medium">
        <div className="bg-background px-3 py-1.5 truncate">
          {diff.a.name} <span className="text-muted-foreground">{diff.a.version}</span>
        </div>
        <div className="bg-background px-3 py-1.5 truncate">
          {diff.b.name} <span className="text-muted-foreground">{diff.b.version}</span>
        </div>
      </div>

      <div className="-mt-3 flex flex-col">
        {diff.paths.map((p, i) => (
          <ElementCard
            key={p.path}
            diff={p}
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
  ref,
}: {
  diff: PathDiff
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
      <div className="grid grid-cols-2 gap-px bg-border">
        {diff.fields.map((f) => (
          <FieldRow key={f.label} field={f} />
        ))}
      </div>
    </section>
  )
}

/** One field rendered across both columns (A on the left, B on the right). */
function FieldRow({ field }: { field: FieldChange }) {
  return (
    <>
      <Cell label={field.label} value={field.a} side="a" kind={field.kind} />
      <Cell label={field.label} value={field.b} side="b" kind={field.kind} />
    </>
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
    <div className={`bg-background px-3 py-1.5 text-sm ${tint}`}>
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
