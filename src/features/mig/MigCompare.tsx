import { useEffect, useState } from "react"
import {
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  CaretDoubleLeftIcon,
  CaretDoubleRightIcon,
  FloppyDiskIcon,
  GitDiffIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import { resolveMessage } from "@/core/erepository/resolveMessage"
import { elementAtPath } from "@/core/erepository/elementPath"
import { buildPathOrder } from "@/core/mig/serializeMig"
import { applyFieldCopy } from "@/core/mig/copyChange"
import {
  compareMigs,
  type FieldChange,
  type FieldRef,
  type PathDiff,
} from "@/core/mig/compareMigs"
import { loadMig, saveMig } from "@/core/storage/migStore"
import type {
  ERepository,
  MessageImplementationGuide,
} from "@/core/types/types"
import { hashFor, navigate } from "@/app/routes"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useDiffCardNav } from "./useDiffCardNav"
import { COLS, Cell, Home, Notice } from "./diffView"

type Loaded = {
  a: MessageImplementationGuide | null
  b: MessageImplementationGuide | null
}

type CopyDir = "a-to-b" | "b-to-a"
type CopyFn = (path: string, ref: FieldRef, dir: CopyDir) => void

/**
 * Compare two MIGs. Loads both by key, resolves the message
 * for schema-order alignment, and renders a side-by-side diff of their *declared*
 * overrides — showing only elements (and fields) that differ. Each field can be
 * copied across to the other MIG (hover-revealed buttons); the copy persists and
 * the now-matching field drops out of the diff. Keyboard: j/k or ↑/↓ step between
 * changed elements.
 */
export function MigCompare({
  keyA,
  keyB,
  repo,
}: {
  keyA: string
  keyB: string
  repo: ERepository
}) {
  const [status, setStatus] = useState<"loading" | "ready">("loading")
  // `saved` mirrors what's in storage; `draft` holds the in-progress copies.
  // Edits go to the draft and only persist on Save (reference-equal until then).
  const [saved, setSaved] = useState<Loaded>({ a: null, b: null })
  const [draft, setDraft] = useState<Loaded>({ a: null, b: null })
  const [confirmNavOpen, setConfirmNavOpen] = useState(false)

  // Reference inequality is enough: only applyFieldCopy produces new objects.
  // Computed before the early returns so the unload guard's deps stay stable.
  const dirty = draft.a !== saved.a || draft.b !== saved.b

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

  // Warn on tab close / reload while there are unsaved copies. (In-app navigation
  // is hash-based and doesn't fire `beforeunload`; the Back link is guarded
  // separately below.)
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])

  if (status === "loading") return <Notice title="Loading…" />

  const { a, b } = draft
  if (!a || !b) {
    const missing = [!a && keyA, !b && keyB].filter(Boolean) as string[]
    return (
      <Notice title="MIG not found">
        Couldn’t load {missing.map((k) => `“${k}”`).join(" and ")}. They may
        have been deleted. Return to <Home /> to see your MIGs.
      </Notice>
    )
  }

  // Resolve each MIG's own message version. They share a family but may differ in
  // flavour/version, so an element present in one can be absent in the other.
  const messageA = resolveMessage(repo, a.messageIdentifier)?.current
  const messageB = resolveMessage(repo, b.messageIdentifier)?.current
  const order =
    messageA || messageB
      ? buildPathOrder((messageA ?? messageB)!.rootElement)
      : undefined
  // Element name from whichever version has the path (versions can differ).
  const nameFor = (path: string) =>
    (messageA && elementAtPath(messageA.rootElement, path)?.name) ||
    (messageB && elementAtPath(messageB.rootElement, path)?.name) ||
    undefined

  const diff = compareMigs(a, b, order, nameFor)

  // A copy may only target a path that exists in the *target* MIG's message
  // version — otherwise it would create an orphan override. When the target's
  // message isn't in the loaded e-Repository we can't check, so we allow it.
  const canCopy = (dir: CopyDir, path: string): boolean => {
    const target = dir === "a-to-b" ? messageB : messageA
    return !target || elementAtPath(target.rootElement, path) !== null
  }

  // Copy one field from one MIG into the other — applied to the draft only. The
  // edited field then matches and drops out of the recomputed diff; persistence
  // waits for Save.
  const copy: CopyFn = (path, ref, dir) => {
    const [from, to] = dir === "a-to-b" ? [a, b] : [b, a]
    const next = applyFieldCopy(from, to, path, ref)
    setDraft(dir === "a-to-b" ? { a, b: next } : { a: next, b })
  }

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
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6 xl:max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <GitDiffIcon className="size-5 text-muted-foreground" aria-hidden />
          Compare MIGs
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          {dirty && (
            <span
              className="text-xs text-amber-700 dark:text-amber-500"
              aria-live="polite"
            >
              Unsaved changes
            </span>
          )}
          {dirty && (
            <Button variant="outline" size="sm" onClick={discard}>
              <ArrowCounterClockwiseIcon data-icon="inline-start" aria-hidden />
              Discard
            </Button>
          )}
          <Button size="sm" disabled={!dirty} onClick={save}>
            <FloppyDiskIcon data-icon="inline-start" aria-hidden />
            Save
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href={hashFor({ name: "home" })}
              onClick={(e) => {
                if (dirty) {
                  e.preventDefault()
                  setConfirmNavOpen(true)
                }
              }}
            >
              <ArrowLeftIcon data-icon="inline-start" aria-hidden />
              Back
            </a>
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmNavOpen}
        onOpenChange={setConfirmNavOpen}
        title="Discard unsaved changes?"
        description="You’ve copied changes that haven’t been saved. Leaving this screen will discard them."
        confirmLabel="Discard & leave"
        destructive
        onConfirm={() => navigate({ name: "home" })}
      />

      {!diff.sameMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-500"
        >
          <WarningIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            These MIGs target different messages (
            <code>{a.messageIdentifier}</code> vs{" "}
            <code>{b.messageIdentifier}</code>). Paths are compared by name
            only.
          </p>
        </div>
      )}

      {diff.paths.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          These two MIGs have identical overrides — nothing to compare.
        </p>
      ) : (
        <ComparePanel diff={diff} copy={copy} canCopy={canCopy} />
      )}
    </div>
  )
}

function ComparePanel({
  diff,
  copy,
  canCopy,
}: {
  diff: ReturnType<typeof compareMigs>
  copy: CopyFn
  canCopy: (dir: CopyDir, path: string) => boolean
}) {
  const { containerRef, cardRefs, onKeyDown } = useDiffCardNav()

  const aLabel = `${diff.a.name} ${diff.a.version}`
  const bLabel = `${diff.b.name} ${diff.b.version}`

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-3 outline-none"
    >
      {/* Column headers: MIG A (left) vs MIG B (right) sit above the table like a label
          for each column — underlined only, not boxed into the table. */}
      <div className={`${COLS} -mb-1 text-sm font-semibold tracking-tight`}>
        <div className="truncate pb-1.5">
          {diff.a.name}{" "}
          <span className="text-sm font-medium text-muted-foreground">
            {diff.a.version}
          </span>
        </div>
        <div />
        <div className="truncate pb-1.5">
          {diff.b.name}{" "}
          <span className="text-sm font-medium text-muted-foreground">
            {diff.b.version}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span aria-live="polite">
          {diff.paths.length === 1
            ? "1 element differs"
            : `${diff.paths.length} elements differ`}
        </span>
        <span className="hidden sm:inline">
          <kbd className="rounded border px-1">j</kbd>/
          <kbd className="rounded border px-1">k</kbd> to step · hover a row to
          copy across
        </span>
      </div>

      <div className="flex flex-col overflow-hidden rounded-md border">
        {diff.paths.map((p, i) => (
          <ElementCard
            key={p.path}
            diff={p}
            copy={copy}
            canCopy={canCopy}
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

function ElementCard({
  diff,
  copy,
  canCopy,
  aLabel,
  bLabel,
  ref,
}: {
  diff: PathDiff
  copy: CopyFn
  canCopy: (dir: CopyDir, path: string) => boolean
  aLabel: string
  bLabel: string
  ref: (el: HTMLElement | null) => void
}) {
  // Path existence is per-element, not per-field — compute once for the card.
  const canToB = canCopy("a-to-b", diff.path)
  const canToA = canCopy("b-to-a", diff.path)
  return (
    <section
      ref={ref}
      tabIndex={0}
      aria-label={diff.name}
      className="group/card border-b outline-none last:border-b-0 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset"
    >
      <header className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5">
        <span className="text-sm font-medium">{diff.name}</span>
        <code
          title={diff.path}
          className="truncate text-[0.625rem] text-muted-foreground"
        >
          {diff.path}
        </code>
      </header>
      <div className="flex flex-col divide-y">
        {diff.fields.map((f) => (
          <FieldRow
            key={f.label}
            field={f}
            onCopy={(dir) => copy(diff.path, f.ref, dir)}
            canToA={canToA}
            canToB={canToB}
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
  canToA,
  canToB,
  aLabel,
  bLabel,
}: {
  field: FieldChange
  onCopy: (dir: CopyDir) => void
  canToA: boolean
  canToB: boolean
  aLabel: string
  bLabel: string
}) {
  return (
    <div className={`group ${COLS}`}>
      <Cell label={field.label} value={field.a} side="a" kind={field.kind} />
      <div className="flex items-center justify-center gap-0.5 border-x bg-muted/10 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible/card:opacity-100 focus-within:opacity-100">
        <CopyButton
          dir="right"
          disabled={!canToB}
          label={
            canToB
              ? `Copy ${field.label} to ${bLabel}`
              : `Can’t copy: ${bLabel} has no element at this path`
          }
          onClick={() => onCopy("a-to-b")}
        />
        <CopyButton
          dir="left"
          disabled={!canToA}
          label={
            canToA
              ? `Copy ${field.label} to ${aLabel}`
              : `Can’t copy: ${aLabel} has no element at this path`
          }
          onClick={() => onCopy("b-to-a")}
        />
      </div>
      <Cell label={field.label} value={field.b} side="b" kind={field.kind} />
    </div>
  )
}

function CopyButton({
  dir,
  disabled,
  label,
  onClick,
}: {
  dir: "left" | "right"
  disabled: boolean
  label: string
  onClick: () => void
}) {
  const Icon = dir === "right" ? CaretDoubleRightIcon : CaretDoubleLeftIcon
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded p-0.5 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-30"
    >
      <Icon className="size-3.5" aria-hidden />
    </button>
  )
}
