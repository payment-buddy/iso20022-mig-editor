import { useEffect, useRef, useState } from "react"
import { Check, DownloadSimple, FileText, ShieldCheck, Table } from "@phosphor-icons/react"
import { resolveMessage } from "@/core/erepository/resolveMessage"
import { elementAtPath } from "@/core/erepository/elementPath"
import { effectiveMig } from "@/core/mig/effectiveMig"
import { getMigKey } from "@/core/mig/migKey"
import { renameMig } from "@/core/mig/renameMig"
import { buildPathOrder } from "@/core/mig/serializeMig"
import { validateMigConsistency } from "@/core/mig/validateMig"
import {
  addConstraint,
  clearOverrideField,
  nextConstraintName,
  removeConstraint,
  setOverrideField,
  updateConstraint,
} from "@/core/mig/overrides"
import { deleteMig, loadAllMigs, saveMig } from "@/core/storage/migStore"
import type { Constraint, ERepository, MessageImplementationGuide } from "@/core/types/types"
import { hashFor, navigate } from "@/app/routes"
import { Button } from "@/components/ui/button"
import {
  DetailPanel,
  ElementTree,
  Field,
  type ElementTreeHandle,
} from "@/features/repository/ElementTree"
import { MigMetadata } from "./MigMetadata"
import { MigElementDetail } from "./MigElementDetail"
import { MigConstraintDetail } from "./MigConstraintDetail"
import { MigDiagnostics } from "./MigDiagnostics"
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
  // Effective overrides (own + inherited chain) — drive the tree's cardinality
  // and excluded styling.
  const effectiveOverrides = effectiveMig(mig, allMigs).mig.elementOverrides

  // Advisory loosening/consistency diagnostics across the whole MIG.
  const diagnostics = validateMigConsistency(mig, inheritedOverrides, resolved.current)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            {resolved.current.name} · {mig.messageIdentifier}
          </p>
          <h1 className="text-base font-semibold tracking-tight">{mig.name}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setValidateOpen(true)}>
            <ShieldCheck data-icon="inline-start" aria-hidden />
            Validate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadMigMarkdown(mig, allMigs, resolved.current)}
          >
            <FileText data-icon="inline-start" aria-hidden />
            Markdown
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadMigCsv(mig, allMigs, resolved.current)}
          >
            <Table data-icon="inline-start" aria-hidden />
            CSV
          </Button>
          <Button size="sm" onClick={() => downloadMigs([mig], buildPathOrder(root))}>
            <DownloadSimple data-icon="inline-start" aria-hidden />
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
                propertyNames={mig.elementAnnotationNames ?? []}
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
            // Standard, spec-inherited constraints are read-only; MIG-specific
            // (added) ones are editable.
            if (!sel.added) {
              return <ConstraintDetail constraint={sel.constraint} path={sel.path} />
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
                path={sel.path}
                takenNames={takenNames}
                annotationNames={mig.constraintAnnotationNames ?? []}
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

/** Read-only detail for a standard, spec-inherited constraint. */
function ConstraintDetail({ constraint, path }: { constraint: Constraint; path: string }) {
  return (
    <DetailPanel label="Constraint details">
      <div className="flex items-center gap-1.5 font-medium">
        <Check className="size-3.5 text-muted-foreground" aria-hidden />
        {constraint.name}
      </div>
      <Field label="Path">
        <code className="text-xs">{path}</code>
      </Field>
      {constraint.definition && (
        <Field label="Definition">
          <span className="whitespace-pre-wrap">{constraint.definition}</span>
        </Field>
      )}
      {constraint.expression && (
        <Field label="Expression">
          <span className="whitespace-pre-wrap">{constraint.expression}</span>
        </Field>
      )}
    </DetailPanel>
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
