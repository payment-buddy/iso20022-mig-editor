import { useEffect, useRef, useState } from "react"
import { ArrowLeftIcon, ArrowLineLeftIcon, FloppyDiskIcon, GitMergeIcon, UploadSimpleIcon, WarningIcon } from "@phosphor-icons/react"
import { resolveMessage } from "@/core/erepository/resolveMessage"
import { elementAtPath } from "@/core/erepository/elementPath"
import { shortCodeForIdentifier } from "@/core/erepository/messageIdentifier"
import { buildPathOrder } from "@/core/mig/serializeMig"
import { compareMigs, type FieldChange, type PathDiff } from "@/core/mig/compareMigs"
import { applyFieldCopy } from "@/core/mig/copyChange"
import { appendRevision } from "@/core/mig/revisions"
import { loadMig, saveMig } from "@/core/storage/migStore"
import { loadRevisions, saveRevisions } from "@/core/storage/revisionStore"
import type { ERepository, MessageImplementationGuide } from "@/core/types/types"
import { hashFor, navigate } from "@/app/routes"
import { Button } from "@/components/ui/button"
import { parseMigYaml } from "./parseMigYaml"
import { peekPendingMerge, takePendingMerge } from "./pendingMerge"

const COLS = "grid grid-cols-[minmax(0,1fr)_3.25rem_minmax(0,1fr)]"

/**
 * Merge an uploaded MIG into an existing one. Works
 * like Compare: it diffs the stored target (current) against the uploaded MIG
 * (incoming) side-by-side and lets you copy individual incoming changes into a
 * draft of the current MIG (resolved fields drop out of the diff). Save persists
 * the merged result under the target's key. Only the current side is written;
 * the incoming upload is throwaway. Reached from the import-duplicate "Merge"
 * action (which hands the parsed MIG over) or by uploading on this screen.
 */
export function MigMerge({ targetKey, repo }: { targetKey: string; repo: ERepository }) {
  const [status, setStatus] = useState<"loading" | "ready">("loading")
  const [saved, setSaved] = useState<MessageImplementationGuide | null>(null)
  const [draft, setDraft] = useState<MessageImplementationGuide | null>(null)
  // Pick up an incoming MIG handed off from the import-duplicate "Merge" action,
  // so it isn't re-uploaded. `peek` (not `take`) keeps the initializer pure under
  // StrictMode's double-invoke; the effect below clears the one-shot afterwards.
  const [incoming, setIncoming] = useState<MessageImplementationGuide | null>(() =>
    peekPendingMerge(targetKey),
  )
  const [uploadError, setUploadError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Clear the one-shot handoff now that the initializer has captured it (a module
  // write, not a setState — safe to run in an effect).
  useEffect(() => {
    takePendingMerge(targetKey)
  }, [targetKey])

  useEffect(() => {
    let active = true
    loadMig(targetKey)
      .then((mig) => {
        if (!active) return
        setSaved(mig)
        setDraft(mig)
        setStatus("ready")
      })
      .catch((err) => {
        console.error("Failed to load MIG for merge:", err)
        if (active) setStatus("ready")
      })
    return () => {
      active = false
    }
  }, [targetKey])

  if (status === "loading") return <Notice title="Loading…" />
  if (!saved || !draft) {
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
    setUpload(migs[0], null)
  }
  const setUpload = (mig: MessageImplementationGuide | null, error: string | null) => {
    setIncoming(mig)
    setUploadError(error)
  }

  const message = resolveMessage(repo, draft.messageIdentifier)?.current
  const order = message ? buildPathOrder(message.rootElement) : undefined
  const nameFor = (path: string) =>
    message ? elementAtPath(message.rootElement, path)?.name : undefined

  const familyMismatch =
    incoming != null &&
    shortCodeForIdentifier(incoming.messageIdentifier) !==
      shortCodeForIdentifier(draft.messageIdentifier)

  const diff = incoming && !familyMismatch ? compareMigs(draft, incoming, order, nameFor) : null
  const dirty = draft !== saved

  // Taking writes into the current draft, so the path must exist in the current
  // MIG's message version — otherwise the merge would create an orphan override.
  const canTake = (path: string) => !message || elementAtPath(message.rootElement, path) !== null

  // Copy one incoming field into the current draft. The field then matches and
  // drops out of the recomputed diff; persistence waits for Save.
  const take = (path: string, field: FieldChange) => {
    if (!incoming) return
    setDraft(applyFieldCopy(incoming, draft, path, field.ref))
  }

  const save = async () => {
    try {
      await saveMig(draft)
      // Record the merge in the target's history (when something was actually
      // taken). Seed the pre-merge state as a baseline if there's no history yet,
      // so the "Merged" revision diffs against it.
      if (draft !== saved) {
        const now = Date.now()
        const existing = await loadRevisions(targetKey)
        const seeded = existing.length === 0 ? appendRevision(existing, saved, now) : existing
        await saveRevisions(targetKey, appendRevision(seeded, draft, now, "Merged"))
      }
      navigate({ name: "mig", key: targetKey })
    } catch (err) {
      console.error("Failed to save merged MIG:", err)
    }
  }
  const discard = () => setDraft(saved)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitMergeIcon className="size-3.5" aria-hidden />
            Merge into · {draft.messageIdentifier}
          </p>
          <h1 className="text-base font-semibold tracking-tight">
            {draft.name} <span className="text-muted-foreground">{draft.version}</span>
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {dirty && (
            <span className="text-xs text-amber-700 dark:text-amber-500">Unsaved merge</span>
          )}
          {dirty && (
            <Button variant="outline" size="sm" onClick={discard}>
              Discard
            </Button>
          )}
          {incoming && !familyMismatch && (
            <Button size="sm" disabled={!dirty} onClick={save}>
              <FloppyDiskIcon data-icon="inline-start" aria-hidden />
              Save
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={hashFor({ name: "home" })}>
              <ArrowLeftIcon data-icon="inline-start" aria-hidden />
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
        <Alert>{uploadError}</Alert>
      )}

      {!incoming ? (
        <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border p-6">
          <p className="text-sm text-muted-foreground">
            Upload a MIG of the same message family to merge into{" "}
            <span className="font-medium text-foreground">
              {draft.name} {draft.version}
            </span>
            . You’ll copy changes across field by field.
          </p>
          <Button size="sm" onClick={() => inputRef.current?.click()}>
            <UploadSimpleIcon data-icon="inline-start" aria-hidden />
            Upload MIG to merge
          </Button>
        </div>
      ) : familyMismatch ? (
        <Alert>
          That MIG targets {incoming.messageIdentifier}, a different message family than{" "}
          {draft.messageIdentifier}. Upload a MIG of the same family to merge.
        </Alert>
      ) : !diff || diff.paths.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          The uploaded MIG ({incoming.name} {incoming.version}) has no differences from this one —
          nothing to merge.
        </p>
      ) : (
        <MergePanel diff={diff} incoming={incoming} canTake={canTake} onTake={take} />
      )}
    </div>
  )
}

function MergePanel({
  diff,
  incoming,
  canTake,
  onTake,
}: {
  diff: ReturnType<typeof compareMigs>
  incoming: MessageImplementationGuide
  canTake: (path: string) => boolean
  onTake: (path: string, field: FieldChange) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs text-muted-foreground">
        {diff.paths.length} element{diff.paths.length === 1 ? "" : "s"} differ · hover a row and take
        the incoming value
      </div>

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
          <ElementCard key={p.path} diff={p} disabled={!canTake(p.path)} onTake={onTake} />
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
  disabled,
  onTake,
}: {
  diff: PathDiff
  disabled: boolean
  onTake: (path: string, field: FieldChange) => void
}) {
  return (
    <section aria-label={`${diff.name} — ${KIND_BADGE[diff.kind]}`} className="border border-t-0">
      <header className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5">
        <span className="text-sm font-medium">{diff.name}</span>
        <code title={diff.path} className="truncate text-[0.625rem] text-muted-foreground">
          {diff.path}
        </code>
        <span className="ml-auto shrink-0 text-xs font-medium text-muted-foreground">
          {disabled ? "not in current version" : KIND_BADGE[diff.kind]}
        </span>
      </header>
      <div className="flex flex-col divide-y">
        {diff.fields.map((f) => (
          <div key={f.label} className={`group ${COLS}`}>
            <Cell label={f.label} value={f.a} />
            <div className="flex items-center justify-center border-x bg-muted/10 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <button
                type="button"
                onClick={() => onTake(diff.path, f)}
                disabled={disabled}
                aria-label={
                  disabled
                    ? `Can’t take ${f.label}: this version has no element at this path`
                    : `Take incoming ${f.label}`
                }
                title={disabled ? "This version has no element at this path" : "Take incoming value"}
                className="rounded p-0.5 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-30"
              >
                <ArrowLineLeftIcon className="size-3.5" aria-hidden />
              </button>
            </div>
            <Cell label={f.label} value={f.b} accent />
          </div>
        ))}
      </div>
    </section>
  )
}

/** One side's value, tri-state aware. The incoming side is tinted when present. */
function Cell({ label, value, accent = false }: { label: string; value: string | null; accent?: boolean }) {
  const tint = accent && value !== null ? "bg-emerald-500/10" : ""
  return (
    <div className={`px-3 py-1.5 text-sm ${tint}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="break-words">
        {value === null ? <span className="italic text-muted-foreground/70">inherits</span> : value}
      </div>
    </div>
  )
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <WarningIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>{children}</p>
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
