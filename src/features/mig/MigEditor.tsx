import { useEffect, useRef, useState } from "react"
import {
  ArrowUUpLeftIcon,
  ArrowUUpRightIcon,
  ClockCounterClockwiseIcon,
  DownloadSimpleIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react"
import { resolveMessage } from "@/core/erepository/resolveMessage"
import { elementAtPath } from "@/core/erepository/elementPath"
import { constraintAnnotations } from "@/core/mig/constraints"
import { effectiveMig } from "@/core/mig/effectiveMig"
import { getMigKey } from "@/core/mig/migKey"
import { renameMig } from "@/core/mig/renameMig"
import { buildPathOrder } from "@/core/mig/serializeMig"
import { validateMigConsistency } from "@/core/mig/validateMig"
import {
  addConstraint,
  clearConstraintOverrideField,
  clearOverrideField,
  nextConstraintName,
  removeConstraint,
  setConstraintOverrideField,
  setOverrideField,
  updateConstraint,
} from "@/core/mig/overrides"
import { deleteMig, loadAllMigs, saveMig } from "@/core/storage/migStore"
import { renameRevisions } from "@/core/storage/revisionStore"
import type {
  ERepository,
  MessageImplementationGuide,
} from "@/core/types/types"
import { hashFor, navigate } from "@/app/routes"
import { Button } from "@/components/ui/button"
import { InlineEdit } from "@/components/ui/inline-edit"
import {
  ElementTree,
  type ElementTreeHandle,
} from "@/features/repository/ElementTree"
import { MigMetadata } from "./MigMetadata"
import { MigElementDetail } from "./MigElementDetail"
import { MigConstraintDetail } from "./MigConstraintDetail"
import { MigStandardConstraintDetail } from "./MigStandardConstraintDetail"
import { useRevisionSnapshots } from "./useRevisionSnapshots"
import { MigDiagnostics } from "./MigDiagnostics"
import { ExportMenu } from "./ExportMenu"
import { ValidateInstanceDialog } from "./ValidateInstanceDialog"
import {
  downloadMigExcel,
  downloadMigMarkdown,
  downloadMigs,
} from "./downloadMigs"

type Status = "loading" | "missing" | "ready"

/** Cap the undo history so a long editing session can't grow it unbounded. */
const UNDO_LIMIT = 100

/**
 * Whether a keydown target is a text-editing control — there ⌘/Ctrl-Z must stay
 * the browser's native text-undo, not the MIG-level undo.
 */
function isTextEditing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  )
}

/**
 * MIG Editor. Loads the MIG by key, resolves its message in
 * the e-Repository, and shows the editable metadata block plus the element tree.
 * The inline-edit detail panel lands in a later slice.
 */
export function MigEditor({
  migKey,
  repo,
  selectPath,
}: {
  migKey: string
  repo: ERepository
  /** xmlPath (or constraint-node path) to select once loaded — a search deep link. */
  selectPath?: string
}) {
  const [status, setStatus] = useState<Status>("loading")
  const [mig, setMig] = useState<MessageImplementationGuide | null>(null)
  const [allMigs, setAllMigs] = useState<MessageImplementationGuide[]>([])
  const [validateOpen, setValidateOpen] = useState(false)
  // Error from renaming via the header title (duplicate/blank); cleared on success.
  const [renameError, setRenameError] = useState<string | null>(null)
  // Undo/redo stacks of prior MIG snapshots (most recent last). Edits push onto
  // `past` and clear `future`; undo/redo move the current state between them.
  const [past, setPast] = useState<MessageImplementationGuide[]>([])
  const [future, setFuture] = useState<MessageImplementationGuide[]>([])
  // Whether a text field is focused — undo there belongs to the browser, so the
  // buttons are disabled (mirrors the keyboard guard).
  const [editingText, setEditingText] = useState(false)
  const treeRef = useRef<ElementTreeHandle>(null)
  // Latest undo/redo closures, so the once-registered key handler stays current.
  const historyRef = useRef<{ undo: () => void; redo: () => void }>(null)

  useEffect(() => {
    let active = true
    loadAllMigs()
      .then((all) => {
        if (!active) return
        const found = all.find((m) => getMigKey(m) === migKey) ?? null
        setAllMigs(all)
        setMig(found)
        setStatus(found ? "ready" : "missing")
      })
      .catch((err) => {
        console.error("Failed to load MIG:", err)
        if (active) setStatus("missing")
      })
    return () => {
      active = false
    }
  }, [migKey])

  // Auto-snapshot edits into the MIG's revision history (debounced; flushes on
  // unmount). `flushRevisions` lets the rename flow commit before it re-keys.
  const flushRevisions = useRevisionSnapshots(migKey, mig)

  // Select the deep-linked element/constraint once the tree exists (status
  // becomes "ready"), and whenever the target changes for the same MIG.
  useEffect(() => {
    if (selectPath && status === "ready") treeRef.current?.select(selectPath)
  }, [selectPath, status])

  // Apply a MIG state: reflect it locally and autosave (no history side effects).
  const applyMig = (next: MessageImplementationGuide) => {
    setMig(next)
    setAllMigs((prev) => prev.map((m) => (getMigKey(m) === migKey ? next : m)))
    saveMig(next).catch((err) => console.error("Failed to save MIG:", err))
  }

  // Autosave an edit, recording the prior state for undo and dropping any redo.
  const persist = (next: MessageImplementationGuide) => {
    if (mig) setPast((p) => [...p, mig].slice(-UNDO_LIMIT))
    setFuture([])
    applyMig(next)
  }

  const undo = () => {
    if (!mig || past.length === 0) return
    setPast((p) => p.slice(0, -1))
    setFuture((f) => [...f, mig])
    applyMig(past[past.length - 1])
  }

  const redo = () => {
    if (!mig || future.length === 0) return
    setFuture((f) => f.slice(0, -1))
    setPast((p) => [...p, mig])
    applyMig(future[future.length - 1])
  }
  // Keep the once-registered key handler's view of undo/redo current.
  useEffect(() => {
    historyRef.current = { undo, redo }
  })

  // ⌘/Ctrl-Z undoes the last edit; add Shift (or Ctrl-Y) to redo. Skipped while a
  // text field is focused, so it stays the browser's native text-undo there.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const key = e.key.toLowerCase()
      const isUndo = key === "z" && !e.shiftKey
      const isRedo = (key === "z" && e.shiftKey) || key === "y"
      if (!isUndo && !isRedo) return
      if (isTextEditing(e.target)) return
      e.preventDefault()
      if (isRedo) historyRef.current?.redo()
      else historyRef.current?.undo()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Track whether focus is in a text field, so the Undo/Redo buttons disable
  // there (consistent with the keyboard guard). `focusout.relatedTarget` is the
  // element about to receive focus — including `null` when focus leaves entirely.
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => setEditingText(isTextEditing(e.target))
    const onFocusOut = (e: FocusEvent) =>
      setEditingText(isTextEditing(e.relatedTarget))
    document.addEventListener("focusin", onFocusIn)
    document.addEventListener("focusout", onFocusOut)
    return () => {
      document.removeEventListener("focusin", onFocusIn)
      document.removeEventListener("focusout", onFocusOut)
    }
  }, [])

  // Rename (name and/or version) → a new identity key: write under the new key,
  // repoint child MIGs' parentMIG, drop the old key, move the revision history,
  // and route to the new one. Returns an error message, or `null` on success/no-op.
  const rename = async (
    name: string,
    version: string
  ): Promise<string | null> => {
    const result = renameMig(allMigs, migKey, name, version)
    if (!result.ok) return result.error
    if (!result.changed) return null
    await flushRevisions() // commit any pending burst under the old key first
    await saveMig(result.renamed)
    await Promise.all(result.reparented.map(saveMig))
    await deleteMig(result.oldKey)
    await renameRevisions(result.oldKey, result.newKey)
    navigate({ name: "mig", key: result.newKey })
    return null
  }

  if (status === "loading") {
    return <Notice title="Loading MIG…" />
  }

  if (status === "missing" || !mig) {
    return (
      <Notice title="MIG not found">
        No MIG is stored under “{migKey}”. It may have been deleted. Return to{" "}
        <Home /> to see your MIGs.
      </Notice>
    )
  }

  const resolved = resolveMessage(repo, mig.messageIdentifier)

  if (!resolved) {
    return (
      <Notice title={mig.name}>
        This MIG targets message <code>{mig.messageIdentifier}</code>, which
        isn’t in the loaded e-Repository. Update the e-Repository from <Home />{" "}
        and try again.
      </Notice>
    )
  }

  const root = resolved.current.rootElement

  // Inherited baseline = the parent chain's effective overrides (empty when this
  // MIG has no parent, or its parent isn't loaded). Drives the detail panel's
  // inherited/overridden-here affordances and reset targets.
  const parent = mig.parentMIG
    ? allMigs.find((m) => getMigKey(m) === mig.parentMIG)
    : undefined
  const inheritedOverrides = parent
    ? effectiveMig(parent, allMigs).mig.elementOverrides
    : {}
  // Effective MIG (own + inherited chain): its overrides drive the tree's
  // cardinality/excluded styling, and its merged annotation-name lists drive
  // which annotation fields the detail panels show (so an inherited annotation is
  // visible even when this MIG doesn't redeclare its name).
  const effective = effectiveMig(mig, allMigs).mig
  const effectiveOverrides = effective.elementOverrides

  // Advisory loosening/consistency diagnostics across the whole MIG.
  const diagnostics = validateMigConsistency(
    mig,
    inheritedOverrides,
    resolved.current
  )

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6 xl:max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="px-2 text-[0.625rem] font-medium tracking-wide text-muted-foreground uppercase">
            Message Implementation Guide
          </p>
          {/* The title is the same rename flow as the metadata Name field. */}
          <InlineEdit
            value={mig.name}
            onCommit={(name) =>
              void rename(name, mig.version).then(setRenameError)
            }
            ariaLabel="MIG name"
            placeholder="MIG name"
            textClassName="text-base font-semibold tracking-tight"
          />
          <p className="px-2 text-xs text-muted-foreground">
            {resolved.current.name} ·{" "}
            <a
              href={hashFor({ name: "message", code: mig.messageIdentifier })}
              className="text-primary underline-offset-4 hover:underline"
            >
              {mig.messageIdentifier}
            </a>
          </p>
          {renameError && (
            <p className="px-2 text-xs text-destructive">{renameError}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Undo/redo are keyboard-first; hide the buttons on small screens. */}
          <div className="hidden items-center gap-1 sm:flex">
            <Button
              variant="outline"
              size="icon"
              aria-label="Undo"
              title="Undo (Ctrl/⌘ Z)"
              disabled={past.length === 0 || editingText}
              onClick={undo}
            >
              <ArrowUUpLeftIcon aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Redo"
              title="Redo (Ctrl/⌘ ⇧ Z)"
              disabled={future.length === 0 || editingText}
              onClick={redo}
            >
              <ArrowUUpRightIcon aria-hidden />
            </Button>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href={hashFor({ name: "history", key: migKey })}>
              <ClockCounterClockwiseIcon data-icon="inline-start" aria-hidden />
              History
            </a>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setValidateOpen(true)}
          >
            <ShieldCheckIcon data-icon="inline-start" aria-hidden />
            Validate
          </Button>
          <ExportMenu
            onMarkdown={() =>
              downloadMigMarkdown(mig, allMigs, resolved.current)
            }
            onExcel={() => downloadMigExcel(mig, allMigs, resolved.current)}
          />
          <Button
            size="sm"
            onClick={() => downloadMigs([mig], buildPathOrder(root))}
          >
            <DownloadSimpleIcon data-icon="inline-start" aria-hidden />
            Download
          </Button>
        </div>
      </div>

      <ValidateInstanceDialog
        open={validateOpen}
        onOpenChange={setValidateOpen}
        message={resolved.current}
        effectiveOverrides={effectiveOverrides}
        onNavigate={(path) => treeRef.current?.select(path)}
      />

      <MigMetadata
        mig={mig}
        allMigs={allMigs}
        onChange={persist}
        onRename={rename}
      />

      <MigDiagnostics
        diagnostics={diagnostics}
        onSelect={(path) => treeRef.current?.select(path)}
      />

      <ElementTree
        ref={treeRef}
        key={mig.messageIdentifier}
        root={root}
        ariaLabel={`${mig.name} structure`}
        elementOverrides={mig.elementOverrides}
        effectiveOverrides={effectiveOverrides}
        renderDetail={(sel, actions) => {
          if (sel?.kind === "element") {
            return (
              // Keyed by path so navigating elements resets any in-progress edit.
              <MigElementDetail
                key={sel.path}
                element={sel.element}
                path={sel.path}
                override={mig.elementOverrides[sel.path]}
                inherited={inheritedOverrides[sel.path]}
                propertyNames={mig.elementAnnotationNames ?? []}
                onSet={(field, value) =>
                  persist(setOverrideField(mig, sel.path, field, value))
                }
                onClear={(field) =>
                  persist(clearOverrideField(mig, sel.path, field))
                }
                onAddConstraint={() => {
                  // Unique within the element across standard + already-added.
                  const existing = [
                    ...sel.element.constraints.map((c) => c.name),
                    ...Object.keys(
                      mig.elementOverrides[sel.path]?.additionalConstraints ??
                        {}
                    ),
                  ]
                  const name = nextConstraintName(existing)
                  persist(
                    addConstraint(mig, sel.path, name, { definition: "" })
                  )
                  // Reveal and select the new constraint under its element.
                  actions.select(`${sel.path}/${name}`)
                }}
              />
            )
          }
          if (sel?.kind === "constraint") {
            // Standard (ISO) and inherited (parent-MIG) constraints: name is
            // read-only, but the MIG can overlay definition/expression. This
            // MIG's own added constraints are fully editable below.
            if (sel.origin !== "own") {
              const elementPath = sel.parentPath
              const name = sel.constraint.name
              return (
                <MigStandardConstraintDetail
                  key={sel.path}
                  constraint={sel.constraint}
                  element={elementAtPath(root, elementPath)}
                  path={sel.path}
                  override={
                    mig.elementOverrides[elementPath]?.constraintOverrides?.[
                      name
                    ]
                  }
                  inherited={
                    inheritedOverrides[elementPath]?.constraintOverrides?.[name]
                  }
                  annotationNames={mig.constraintAnnotationNames ?? []}
                  ownAnnotations={
                    mig.elementOverrides[elementPath]?.constraintOverrides?.[
                      name
                    ]?.annotations ?? {}
                  }
                  inheritedAnnotations={constraintAnnotations(
                    sel.constraint,
                    inheritedOverrides[elementPath]
                  )}
                  onSetAnnotation={(annName, value) => {
                    const cur =
                      mig.elementOverrides[elementPath]?.constraintOverrides?.[
                        name
                      ]?.annotations ?? {}
                    const next = { ...cur }
                    if (value.trim() === "") delete next[annName]
                    else next[annName] = value
                    persist(
                      Object.keys(next).length === 0
                        ? clearConstraintOverrideField(
                            mig,
                            elementPath,
                            name,
                            "annotations"
                          )
                        : setConstraintOverrideField(
                            mig,
                            elementPath,
                            name,
                            "annotations",
                            next
                          )
                    )
                  }}
                  onSetDefinition={(definition) =>
                    persist(
                      setConstraintOverrideField(
                        mig,
                        elementPath,
                        name,
                        "definition",
                        definition
                      )
                    )
                  }
                  onClearDefinition={() =>
                    persist(
                      clearConstraintOverrideField(
                        mig,
                        elementPath,
                        name,
                        "definition"
                      )
                    )
                  }
                  onSetExpression={(expression) =>
                    persist(
                      setConstraintOverrideField(
                        mig,
                        elementPath,
                        name,
                        "expression",
                        expression
                      )
                    )
                  }
                  onClearExpression={() =>
                    persist(
                      clearConstraintOverrideField(
                        mig,
                        elementPath,
                        name,
                        "expression"
                      )
                    )
                  }
                  onSetDisabled={(disabled) =>
                    persist(
                      setConstraintOverrideField(
                        mig,
                        elementPath,
                        name,
                        "disabled",
                        disabled
                      )
                    )
                  }
                  onClearDisabled={() =>
                    persist(
                      clearConstraintOverrideField(
                        mig,
                        elementPath,
                        name,
                        "disabled"
                      )
                    )
                  }
                />
              )
            }
            const elementPath = sel.parentPath
            const owner = elementAtPath(root, elementPath)
            const current = sel.constraint.name
            const takenNames = [
              ...(owner?.constraints ?? []).map((c) => c.name),
              ...Object.keys(
                mig.elementOverrides[elementPath]?.additionalConstraints ?? {}
              ),
            ].filter((n) => n !== current)
            return (
              // Keyed by path so a rename remounts cleanly and resets any edit.
              <MigConstraintDetail
                key={sel.path}
                constraint={sel.constraint}
                element={owner}
                path={sel.path}
                takenNames={takenNames}
                annotationNames={mig.constraintAnnotationNames ?? []}
                disabled={
                  mig.elementOverrides[elementPath]?.additionalConstraints?.[
                    current
                  ]?.enabled === false
                }
                onRename={(name) => {
                  persist(updateConstraint(mig, elementPath, current, { name }))
                  // The path changed; keep the renamed constraint selected.
                  actions.select(`${elementPath}/${name}`)
                }}
                onSetDefinition={(definition) =>
                  persist(
                    updateConstraint(mig, elementPath, current, { definition })
                  )
                }
                onSetExpression={(expression) =>
                  persist(
                    updateConstraint(mig, elementPath, current, { expression })
                  )
                }
                onSetAnnotations={(annotations) =>
                  persist(
                    updateConstraint(mig, elementPath, current, { annotations })
                  )
                }
                onToggleDisabled={(value) =>
                  // The off switch lives on the added constraint itself; enabling
                  // sets `enabled: true`, which `updateConstraint` prunes away.
                  persist(
                    updateConstraint(mig, elementPath, current, {
                      enabled: !value,
                    })
                  )
                }
                onDelete={() => {
                  persist(removeConstraint(mig, elementPath, current))
                  // The constraint is gone; fall back to selecting its element.
                  actions.select(elementPath)
                }}
              />
            )
          }
          return null
        }}
      />
    </div>
  )
}

function Notice({
  title,
  children,
}: {
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-2 p-6 xl:max-w-4xl">
      <h1 className="text-base font-semibold tracking-tight">{title}</h1>
      {children && <p className="text-sm text-muted-foreground">{children}</p>}
    </div>
  )
}

function Home() {
  return (
    <a
      href={hashFor({ name: "home" })}
      className="text-primary underline-offset-4 hover:underline"
    >
      Home
    </a>
  )
}
