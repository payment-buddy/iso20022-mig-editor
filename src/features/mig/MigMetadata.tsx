import { useState, type ReactNode } from "react"
import { Warning } from "@phosphor-icons/react"
import {
  addAnnotation,
  addConstraintAnnotation,
  removeAnnotation,
  removeConstraintAnnotation,
} from "@/core/mig/annotations"
import { getMigKey } from "@/core/mig/migKey"
import { eligibleParents } from "@/core/mig/parentMig"
import type { MessageImplementationGuide } from "@/core/types/types"
import { hashFor } from "@/app/routes"
import { EditableList } from "@/components/ui/editable-list"
import { InlineEdit } from "@/components/ui/inline-edit"

/**
 * Editable MIG metadata block (FUNCTIONALITY §5.7): Description (inline
 * textarea), Parent MIG (eligible-parent dropdown with a link and a not-loaded
 * warning), and the shared element- and constraint-annotation names (values are
 * then filled per target in the detail panels). Name and Version are inline-edit
 * — committing either re-keys the MIG via `onRename` (which re-routes on success
 * and returns an error message on failure).
 */
export function MigMetadata({
  mig,
  allMigs,
  onChange,
  onRename,
}: {
  mig: MessageImplementationGuide
  allMigs: MessageImplementationGuide[]
  onChange: (next: MessageImplementationGuide) => void
  /** Rename to a new name/version (new identity key). Returns an error, or `null`. */
  onRename: (name: string, version: string) => Promise<string | null>
}) {
  const [renameError, setRenameError] = useState<string | null>(null)
  const rename = (name: string, version: string) => {
    void onRename(name, version).then(setRenameError)
  }
  const eligible = eligibleParents(allMigs, mig)
  const parentKey = mig.parentMIG ?? ""
  const parentLoaded = allMigs.find((m) => getMigKey(m) === parentKey)

  const options = [
    { value: "", label: "(none)" },
    ...eligible.map((m) => ({ value: getMigKey(m), label: `${m.name} ${m.version}` })),
  ]
  // Keep the current parent selectable even if it's missing/not loaded.
  if (parentKey && !options.some((o) => o.value === parentKey)) {
    options.push({ value: parentKey, label: `${parentKey} (not loaded)` })
  }

  const setParent = (key: string) => {
    const next = { ...mig }
    if (key) next.parentMIG = key
    else delete next.parentMIG
    onChange(next)
  }

  const setDescription = (text: string) => {
    const next = { ...mig }
    if (text.trim()) next.description = text
    else delete next.description
    onChange(next)
  }

  // Apply add/remove of element-annotation names; removals cascade into every
  // element override (handled by removeAnnotation).
  const setElementAnnotations = (next: string[]) => {
    const current = mig.elementAnnotationNames ?? []
    let result = mig
    for (const name of current.filter((n) => !next.includes(n))) {
      result = removeAnnotation(result, name)
    }
    for (const name of next.filter((n) => !current.includes(n))) {
      result = addAnnotation(result, name)
    }
    onChange(result)
  }

  // Same, for the independent constraint-annotation names; removals cascade into
  // every additional constraint (handled by removeConstraintAnnotation).
  const setConstraintAnnotations = (next: string[]) => {
    const current = mig.constraintAnnotationNames ?? []
    let result = mig
    for (const name of current.filter((n) => !next.includes(n))) {
      result = removeConstraintAnnotation(result, name)
    }
    for (const name of next.filter((n) => !current.includes(n))) {
      result = addConstraintAnnotation(result, name)
    }
    onChange(result)
  }

  return (
    <section aria-label="MIG metadata" className="flex flex-col gap-3">
      <Row label="Name">
        <InlineEdit
          value={mig.name}
          onCommit={(v) => rename(v, mig.version)}
          ariaLabel="Name"
          placeholder="MIG name"
        />
      </Row>
      <Row label="Version">
        <InlineEdit
          value={mig.version}
          onCommit={(v) => rename(mig.name, v)}
          ariaLabel="Version"
          placeholder="Version"
        />
      </Row>
      {renameError && (
        <p role="alert" className="text-xs text-destructive">
          {renameError}
        </p>
      )}
      <Row label="Parent MIG">
        <div className="flex flex-col gap-1">
          <select
            aria-label="Parent MIG"
            value={parentKey}
            onChange={(e) => setParent(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {parentKey && !parentLoaded && (
            <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
              <Warning className="size-3.5 shrink-0" aria-hidden />
              References “{parentKey}”, which isn’t loaded.
            </p>
          )}
          {parentKey && (
            <a
              href={hashFor({ name: "mig", key: parentKey })}
              className="w-fit text-xs text-primary underline-offset-4 hover:underline"
            >
              View parent
            </a>
          )}
        </div>
      </Row>
      <Row label="Description">
        <InlineEdit
          value={mig.description ?? ""}
          onCommit={setDescription}
          ariaLabel="Description"
          placeholder="Add a description…"
          multiline
        />
      </Row>
      <Row label="Element annotations">
        <EditableList
          values={mig.elementAnnotationNames ?? []}
          onChange={setElementAnnotations}
          ariaLabel="Element annotations"
          placeholder="Add an annotation name…"
        />
      </Row>
      <Row label="Constraint annotations">
        <EditableList
          values={mig.constraintAnnotationNames ?? []}
          onChange={setConstraintAnnotations}
          ariaLabel="Constraint annotations"
          placeholder="Add an annotation name…"
        />
      </Row>
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
      <div className="pt-1 text-[0.625rem] tracking-wide text-muted-foreground uppercase sm:w-28 sm:shrink-0">
        {label}
      </div>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
    </div>
  )
}
