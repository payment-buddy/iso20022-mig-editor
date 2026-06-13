import { useEffect, useRef, useState } from "react"
import { ArrowLeft, GitMerge, UploadSimple, Warning } from "@phosphor-icons/react"
import { resolveMessage } from "@/core/erepository/resolveMessage"
import { elementAtPath } from "@/core/erepository/elementPath"
import { shortCodeForIdentifier } from "@/core/erepository/messageIdentifier"
import { buildPathOrder } from "@/core/mig/serializeMig"
import { compareMigs, type FieldRef, type PathDiff } from "@/core/mig/compareMigs"
import { applyFieldCopy } from "@/core/mig/copyChange"
import { effectiveMig } from "@/core/mig/effectiveMig"
import { getMigKey } from "@/core/mig/migKey"
import { validateMigConsistency } from "@/core/mig/validateMig"
import { loadAllMigs, saveMig } from "@/core/storage/migStore"
import type {
  ElementOverrides,
  ERepository,
  MessageImplementationGuide,
} from "@/core/types/types"
import { hashFor, navigate } from "@/app/routes"
import { Button } from "@/components/ui/button"
import { parseMigYaml } from "./parseMigYaml"
import { MigDiagnostics } from "./MigDiagnostics"

const COLS = "grid grid-cols-[minmax(0,1fr)_3.25rem_minmax(0,1fr)]"

/** Stable id for one diffed field, used to track accept choices. */
function fieldId(path: string, ref: FieldRef): string {
  const tail = ref.type === "field" ? ref.field : ref.name
  return `${path}::${ref.type}:${tail}`
}

/**
 * Merge an uploaded MIG into an existing one (FUNCTIONALITY §5.2 / §10). Loads the
 * target by key, accepts an upload of a same-family MIG, and shows a per-field
 * diff where each difference can be **accepted** (take incoming) or **kept**
 * (default). The merged result is `target` with the accepted incoming fields
 * applied (`applyFieldCopy`); Apply persists it under the target's key. Reuses
 * the Compare engine plus the orphan-path and consistency guards.
 */
export function MigMerge({ targetKey, repo }: { targetKey: string; repo: ERepository }) {
  const [status, setStatus] = useState<"loading" | "ready">("loading")
  const [target, setTarget] = useState<MessageImplementationGuide | null>(null)
  const [allMigs, setAllMigs] = useState<MessageImplementationGuide[]>([])
  const [incoming, setIncoming] = useState<MessageImplementationGuide | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState<Set<string>>(() => new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    loadAllMigs()
      .then((all) => {
        if (!active) return
        setAllMigs(all)
        setTarget(all.find((m) => getMigKey(m) === targetKey) ?? null)
        setStatus("ready")
      })
      .catch((err) => {
        console.error("Failed to load MIGs for merge:", err)
        if (active) setStatus("ready")
      })
    return () => {
      active = false
    }
  }, [targetKey])

  if (status === "loading") return <Notice title="Loading…" />
  if (!target) {
    return (
      <Notice title="MIG not found">
        No MIG is stored under “{targetKey}”. Return to <Home /> to pick one to merge into.
      </Notice>
    )
  }

  const handleFile = async (file: File) => {
    const { migs, errors } = parseMigYaml(await file.text())
    if (errors.length > 0) return setUpload(null, errors[0])
    if (migs.length === 0) return setUpload(null, "No MIG found in the file.")
    if (migs.length > 1) return setUpload(null, "The file holds several MIGs; upload a single MIG to merge.")
    const candidate = migs[0]
    if (
      shortCodeForIdentifier(candidate.messageIdentifier) !==
      shortCodeForIdentifier(target.messageIdentifier)
    ) {
      return setUpload(
        null,
        `That MIG targets ${candidate.messageIdentifier}, a different message family than ${target.messageIdentifier}.`,
      )
    }
    setUpload(candidate, null)
  }

  const setUpload = (mig: MessageImplementationGuide | null, error: string | null) => {
    setIncoming(mig)
    setUploadError(error)
    setAccepted(new Set())
  }

  const message = resolveMessage(repo, target.messageIdentifier)?.current
  const order = message ? buildPathOrder(message.rootElement) : undefined

  // Accepting writes into the target, so a path must exist in the target's message
  // version — otherwise the merge would create an orphan override.
  const canAccept = (path: string) => !message || elementAtPath(message.rootElement, path) !== null

  const diff = incoming ? compareMigs(target, incoming, order) : null
  const acceptableIds = diff
    ? diff.paths.flatMap((p) => (canAccept(p.path) ? p.fields.map((f) => fieldId(p.path, f.ref)) : []))
    : []
  const allAccepted = acceptableIds.length > 0 && acceptableIds.every((id) => accepted.has(id))

  // The merged MIG: the target with each accepted incoming field applied.
  const merged =
    diff && incoming
      ? diff.paths.reduce(
          (acc, p) =>
            p.fields.reduce(
              (m, f) => (accepted.has(fieldId(p.path, f.ref)) ? applyFieldCopy(incoming, m, p.path, f.ref) : m),
              acc,
            ),
          target,
        )
      : target

  const parent = target.parentMIG
    ? allMigs.find((m) => getMigKey(m) === target.parentMIG)
    : undefined
  const inherited: ElementOverrides = parent ? effectiveMig(parent, allMigs).mig.elementOverrides : {}
  const diagnostics = message ? validateMigConsistency(merged, inherited, message) : []

  const toggle = (id: string) =>
    setAccepted((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleAll = () => setAccepted(allAccepted ? new Set() : new Set(acceptableIds))

  const apply = () => {
    saveMig(merged)
      .then(() => navigate({ name: "mig", key: targetKey }))
      .catch((err) => console.error("Failed to save merged MIG:", err))
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitMerge className="size-3.5" aria-hidden />
            Merge into · {target.messageIdentifier}
          </p>
          <h1 className="text-base font-semibold tracking-tight">
            {target.name} <span className="text-muted-foreground">{target.version}</span>
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {incoming && (
            <Button size="sm" disabled={accepted.size === 0} onClick={apply}>
              <GitMerge data-icon="inline-start" aria-hidden />
              Merge {accepted.size > 0 ? `${accepted.size} ` : ""}change{accepted.size === 1 ? "" : "s"}
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={hashFor({ name: "home" })}>
              <ArrowLeft data-icon="inline-start" aria-hidden />
              Back
            </a>
          </Button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".yaml,.yml"
        aria-label="MIG to merge"
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.[0]) void handleFile(e.target.files[0])
          e.target.value = ""
        }}
      />

      {uploadError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <Warning className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{uploadError}</p>
        </div>
      )}

      {!incoming ? (
        <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border p-6">
          <p className="text-sm text-muted-foreground">
            Upload a MIG of the same message family to merge into{" "}
            <span className="font-medium text-foreground">
              {target.name} {target.version}
            </span>
            . You’ll choose, field by field, which changes to take.
          </p>
          <Button size="sm" onClick={() => inputRef.current?.click()}>
            <UploadSimple data-icon="inline-start" aria-hidden />
            Upload MIG to merge
          </Button>
        </div>
      ) : !diff || diff.paths.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          The uploaded MIG ({incoming.name} {incoming.version}) has no differences from this one —
          nothing to merge.
        </p>
      ) : (
        <MergePanel
          diff={diff}
          incoming={incoming}
          accepted={accepted}
          canAccept={canAccept}
          allAccepted={allAccepted}
          onToggle={toggle}
          onToggleAll={toggleAll}
          diagnostics={
            <MigDiagnostics subject="Merged result" diagnostics={diagnostics} onSelect={() => {}} />
          }
        />
      )}
    </div>
  )
}

function MergePanel({
  diff,
  incoming,
  accepted,
  canAccept,
  allAccepted,
  onToggle,
  onToggleAll,
  diagnostics,
}: {
  diff: ReturnType<typeof compareMigs>
  incoming: MessageImplementationGuide
  accepted: Set<string>
  canAccept: (path: string) => boolean
  allAccepted: boolean
  onToggle: (id: string) => void
  onToggleAll: () => void
  diagnostics: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {diff.paths.length} element{diff.paths.length === 1 ? "" : "s"} differ · check a row to take
          the incoming value
        </span>
        <Button variant="outline" size="sm" onClick={onToggleAll}>
          {allAccepted ? "Keep all current" : "Accept all incoming"}
        </Button>
      </div>

      {diagnostics}

      {/* Column headers: current (target) vs incoming. */}
      <div className={`${COLS} overflow-hidden rounded-t-md border border-b-0 text-xs font-medium`}>
        <div className="truncate px-3 py-1.5">
          Current · {diff.a.name} <span className="text-muted-foreground">{diff.a.version}</span>
        </div>
        <div className="border-x bg-muted/20 text-center text-muted-foreground">take</div>
        <div className="truncate px-3 py-1.5">
          Incoming · {incoming.name} <span className="text-muted-foreground">{incoming.version}</span>
        </div>
      </div>

      <div className="-mt-3 flex flex-col">
        {diff.paths.map((p) => (
          <ElementCard
            key={p.path}
            diff={p}
            accepted={accepted}
            disabled={!canAccept(p.path)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  )
}

const KIND_BADGE: Record<PathDiff["kind"], string> = {
  added: "only in incoming",
  removed: "only in current",
  changed: "changed",
}

function ElementCard({
  diff,
  accepted,
  disabled,
  onToggle,
}: {
  diff: PathDiff
  accepted: Set<string>
  disabled: boolean
  onToggle: (id: string) => void
}) {
  return (
    <section
      aria-label={`${diff.name} — ${KIND_BADGE[diff.kind]}`}
      className="border border-t-0"
    >
      <header className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5">
        <span className="font-medium">{diff.name}</span>
        <code className="truncate text-xs text-muted-foreground">{diff.path}</code>
        <span className="ml-auto shrink-0 text-xs font-medium text-muted-foreground">
          {disabled ? "not in current version" : KIND_BADGE[diff.kind]}
        </span>
      </header>
      <div className="flex flex-col divide-y">
        {diff.fields.map((f) => {
          const id = fieldId(diff.path, f.ref)
          const take = accepted.has(id)
          return (
            <div key={f.label} className={COLS}>
              <Cell label={f.label} value={f.a} chosen={!take} />
              <div className="flex items-center justify-center border-x bg-muted/10">
                <input
                  type="checkbox"
                  checked={take}
                  disabled={disabled}
                  onChange={() => onToggle(id)}
                  aria-label={`Take incoming ${f.label} for ${diff.path}`}
                  title={disabled ? "This version has no element at this path" : undefined}
                />
              </div>
              <Cell label={f.label} value={f.b} chosen={take} accent />
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** One side's value. The chosen side is solid; the other is dimmed. */
function Cell({
  label,
  value,
  chosen,
  accent = false,
}: {
  label: string
  value: string | null
  chosen: boolean
  accent?: boolean
}) {
  const tint = chosen && accent ? "bg-emerald-500/10" : ""
  return (
    <div className={`px-3 py-1.5 text-sm ${tint} ${chosen ? "" : "opacity-50"}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="break-words">
        {value === null ? <span className="italic text-muted-foreground/70">inherits</span> : value}
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
