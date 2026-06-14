import { useEffect, useRef, useState } from "react"
import { DownloadSimpleIcon, ShieldCheckIcon } from "@phosphor-icons/react"
import { resolveMessage } from "@/core/erepository/resolveMessage"
import { elementAtPath } from "@/core/erepository/elementPath"
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
import type { ERepository, MessageImplementationGuide } from "@/core/types/types"
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
import { MigDiagnostics } from "./MigDiagnostics"
import { ExportMenu } from "./ExportMenu"
import { ValidateInstanceDialog } from "./ValidateInstanceDialog"
import { downloadMigCsv, downloadMigMarkdown, downloadMigs } from "./downloadMigs"

type Status = "loading" | "missing" | "ready"

/**
 * MIG Editor (FUNCTIONALITY §5.7). Loads the MIG by key, resolves its message in
 * the e-Repository, and shows the editable metadata block plus the element tree.
 * The inline-edit detail panel lands in a later slice.
 */
export function MigEditor({ migKey, repo }: { migKey: string; repo: ERepository }) {
  const [status, setStatus] = useState<Status>("loading")
  const [mig, setMig] = useState<MessageImplementationGuide | null>(null)
  const [allMigs, setAllMigs] = useState<MessageImplementationGuide[]>([])
  const [validateOpen, setValidateOpen] = useState(false)
  // Error from renaming via the header title (duplicate/blank); cleared on success.
  const [renameError, setRenameError] = useState<string | null>(null)
  const treeRef = useRef<ElementTreeHandle>(null)

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

  // Autosave: persist the edited MIG (same identity key) and reflect it locally.
  const persist = (next: MessageImplementationGuide) => {
    setMig(next)
    setAllMigs((prev) => prev.map((m) => (getMigKey(m) === migKey ? next : m)))
    saveMig(next).catch((err) => console.error("Failed to save MIG:", err))
  }

  // Rename (name and/or version) → a new identity key: write under the new key,
  // repoint child MIGs' parentMIG, drop the old key, and route to the new one.
  // Returns an error message to show, or `null` on success/no-op.
  const rename = async (name: string, version: string): Promise<string | null> => {
    const result = renameMig(allMigs, migKey, name, version)
    if (!result.ok) return result.error
    if (!result.changed) return null
    await saveMig(result.renamed)
    await Promise.all(result.reparented.map(saveMig))
    await deleteMig(result.oldKey)
    navigate({ name: "mig", key: result.newKey })
    return null
  }

  if (status === "loading") {
    return <Notice title="Loading MIG…" />
  }

  if (status === "missing" || !mig) {
    return (
      <Notice title="MIG not found">
        No MIG is stored under “{migKey}”. It may have been deleted. Return to <Home /> to see your
        MIGs.
      </Notice>
    )
  }

  const resolved = resolveMessage(repo, mig.messageIdentifier)

  if (!resolved) {
    return (
      <Notice title={mig.name}>
        This MIG targets message <code>{mig.messageIdentifier}</code>, which isn’t in the loaded
        e-Repository. Update the e-Repository from <Home /> and try again.
      </Notice>
    )
  }

  const root = resolved.current.rootElement

  // Inherited baseline = the parent chain's effective overrides (empty when this
  // MIG has no parent, or its parent isn't loaded). Drives the detail panel's
  // inherited/overridden-here affordances and reset targets.
  const parent = mig.parentMIG ? allMigs.find((m) => getMigKey(m) === mig.parentMIG) : undefined
  const inheritedOverrides = parent ? effectiveMig(parent, allMigs).mig.elementOverrides : {}
  // Effective MIG (own + inherited chain): its overrides drive the tree's
  // cardinality/excluded styling, and its merged annotation-name lists drive
  // which annotation fields the detail panels show (so an inherited annotation is
  // visible even when this MIG doesn't redeclare its name).
  const effective = effectiveMig(mig, allMigs).mig
  const effectiveOverrides = effective.elementOverrides

  // Advisory loosening/consistency diagnostics across the whole MIG.
  const diagnostics = validateMigConsistency(mig, inheritedOverrides, resolved.current)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="px-2 text-[0.625rem] font-medium tracking-wide text-muted-foreground uppercase">
            Message Implementation Guide
          </p>
          {/* The title is the same rename flow as the metadata Name field. */}
          <InlineEdit
            value={mig.name}
            onCommit={(name) => void rename(name, mig.version).then(setRenameError)}
            ariaLabel="MIG name"
            placeholder="MIG name"
            textClassName="text-base font-semibold tracking-tight"
          />
          <p className="px-2 text-xs text-muted-foreground">
            {resolved.current.name} · {mig.messageIdentifier}
          </p>
          {renameError && <p className="px-2 text-xs text-destructive">{renameError}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setValidateOpen(true)}>
            <ShieldCheckIcon data-icon="inline-start" aria-hidden />
            Validate
          </Button>
          <ExportMenu
            onMarkdown={() => downloadMigMarkdown(mig, allMigs, resolved.current)}
            onCsv={() => downloadMigCsv(mig, allMigs, resolved.current)}
          />
          <Button size="sm" onClick={() => downloadMigs([mig], buildPathOrder(root))}>
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

      <MigMetadata mig={mig} allMigs={allMigs} onChange={persist} onRename={rename} />

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
                propertyNames={effective.elementAnnotationNames ?? []}
                onSet={(field, value) => persist(setOverrideField(mig, sel.path, field, value))}
                onClear={(field) => persist(clearOverrideField(mig, sel.path, field))}
                onAddConstraint={() => {
                  // Unique within the element across standard + already-added.
                  const existing = [
                    ...sel.element.constraints.map((c) => c.name),
                    ...(mig.elementOverrides[sel.path]?.additionalConstraints ?? []).map(
                      (c) => c.name,
                    ),
                  ]
                  const name = nextConstraintName(existing)
                  persist(addConstraint(mig, sel.path, { name, definition: "" }))
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
                  override={mig.elementOverrides[elementPath]?.constraintOverrides?.[name]}
                  inherited={inheritedOverrides[elementPath]?.constraintOverrides?.[name]}
                  onSetDefinition={(definition) =>
                    persist(
                      setConstraintOverrideField(mig, elementPath, name, "definition", definition),
                    )
                  }
                  onClearDefinition={() =>
                    persist(clearConstraintOverrideField(mig, elementPath, name, "definition"))
                  }
                  onSetExpression={(expression) =>
                    persist(
                      setConstraintOverrideField(mig, elementPath, name, "expression", expression),
                    )
                  }
                  onClearExpression={() =>
                    persist(clearConstraintOverrideField(mig, elementPath, name, "expression"))
                  }
                  onSetDisabled={(disabled) =>
                    persist(setConstraintOverrideField(mig, elementPath, name, "disabled", disabled))
                  }
                  onClearDisabled={() =>
                    persist(clearConstraintOverrideField(mig, elementPath, name, "disabled"))
                  }
                />
              )
            }
            const elementPath = sel.parentPath
            const owner = elementAtPath(root, elementPath)
            const current = sel.constraint.name
            const takenNames = [
              ...(owner?.constraints ?? []).map((c) => c.name),
              ...(mig.elementOverrides[elementPath]?.additionalConstraints ?? []).map((c) => c.name),
            ].filter((n) => n !== current)
            return (
              // Keyed by path so a rename remounts cleanly and resets any edit.
              <MigConstraintDetail
                key={sel.path}
                constraint={sel.constraint}
                element={owner}
                path={sel.path}
                takenNames={takenNames}
                annotationNames={effective.constraintAnnotationNames ?? []}
                onRename={(name) => {
                  persist(updateConstraint(mig, elementPath, current, { name }))
                  // The path changed; keep the renamed constraint selected.
                  actions.select(`${elementPath}/${name}`)
                }}
                onSetDefinition={(definition) =>
                  persist(updateConstraint(mig, elementPath, current, { definition }))
                }
                onSetExpression={(expression) =>
                  persist(updateConstraint(mig, elementPath, current, { expression }))
                }
                onSetAnnotations={(annotations) =>
                  persist(updateConstraint(mig, elementPath, current, { annotations }))
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
