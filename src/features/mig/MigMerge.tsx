import { useEffect, useRef, useState } from "react"
import { ArrowLeftIcon, CaretDoubleLeftIcon, FloppyDiskIcon, GitMergeIcon, UploadSimpleIcon, WarningIcon } from "@phosphor-icons/react"
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
import { useDiffCardNav } from "./useDiffCardNav"

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
      <div className="flex items-center justify-between gap-4">
        <h1 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <GitMergeIcon className="size-5 text-muted-foreground" aria-hidden />
          Merge MIGs
        </h1>
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
  const { containerRef, cardRefs, onKeyDown } = useDiffCardNav()

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-3 outline-none"
    >
      {/* Column headers: current (target, left) vs incoming (right) sit above the
          table like a label for each column. */}
      <div className={`${COLS} -mb-1 text-sm font-semibold tracking-tight`}>
        <div className="truncate pb-1.5">
          Current · {diff.a.name}{" "}
          <span className="text-sm font-medium text-muted-foreground">{diff.a.version}</span>
        </div>
        <div />
        <div className="truncate pb-1.5">
          Incoming · {incoming.name}{" "}
          <span className="text-sm font-medium text-muted-foreground">{incoming.version}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {diff.paths.length === 1 ? "1 element differs" : `${diff.paths.length} elements differ`}
        </span>
        <span className="hidden sm:inline">
          <kbd className="rounded border px-1">j</kbd>/<kbd className="rounded border px-1">k</kbd>{" "}
          to step · hover a row to take the incoming value
        </span>
      </div>

      <div className="flex flex-col overflow-hidden rounded-md border">
        {diff.paths.map((p, i) => (
          <ElementCard
            key={p.path}
            diff={p}
            disabled={!canTake(p.path)}
            onTake={onTake}
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
  disabled,
  onTake,
  ref,
}: {
  diff: PathDiff
  disabled: boolean
  onTake: (path: string, field: FieldChange) => void
  ref: (el: HTMLElement | null) => void
}) {
  return (
    <section
      ref={ref}
      tabIndex={0}
      aria-label={diff.name}
      className="group/card border-b outline-none last:border-b-0 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset"
    >
      <header className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5">
        <span className="text-sm font-medium">{diff.name}</span>
        <code title={diff.path} className="truncate text-[0.625rem] text-muted-foreground">
          {diff.path}
        </code>
        {disabled && (
          <span className="ml-auto shrink-0 text-xs font-medium text-amber-700 dark:text-amber-500">
            not in current version
          </span>
        )}
      </header>
      <div className="flex flex-col divide-y">
        {diff.fields.map((f) => (
          <div key={f.label} className={`group ${COLS}`}>
            <Cell label={f.label} value={f.a} side="a" kind={f.kind} />
            <div className="flex items-center justify-center border-x bg-muted/10 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 group-focus-visible/card:opacity-100">
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
                <CaretDoubleLeftIcon className="size-3.5" aria-hidden />
              </button>
            </div>
            <Cell label={f.label} value={f.b} side="b" kind={f.kind} />
          </div>
        ))}
      </div>
    </section>
  )
}

/** One side's value, tinted by the kind of change it carries (current = a,
 * incoming = b): removed → red on current, added → green on incoming, changed →
 * blue on both. A null value means that MIG doesn't set the field. */
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
  const tinted =
    kind === "changed" || (kind === "removed" && side === "a") || (kind === "added" && side === "b")
  const tint =
    !tinted || value === null
      ? ""
      : kind === "added"
        ? "bg-emerald-500/10"
        : kind === "removed"
          ? "bg-destructive/10"
          : "bg-blue-500/10"
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
