import { type ReactNode } from "react"
import { Warning } from "@phosphor-icons/react"
import { getMigKey } from "@/core/mig/migKey"
import { eligibleParents } from "@/core/mig/parentMig"
import type { MessageImplementationGuide } from "@/core/types/types"
import { hashFor } from "@/app/routes"
import { InlineEdit } from "@/components/ui/inline-edit"

/**
 * Editable MIG metadata block (FUNCTIONALITY §5.7). This slice: Description
 * (inline textarea) and Parent MIG (eligible-parent dropdown with a link and a
 * not-loaded warning). Name and Version are shown read-only — their
 * identity-key rename + reference rewrite lands in a follow-up slice.
 */
export function MigMetadata({
  mig,
  allMigs,
  onChange,
}: {
  mig: MessageImplementationGuide
  allMigs: MessageImplementationGuide[]
  onChange: (next: MessageImplementationGuide) => void
}) {
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

  return (
    <section aria-label="MIG metadata" className="flex flex-col gap-3">
      <Row label="Name">
        <span title="Renaming the MIG lands in a later slice.">{mig.name}</span>
      </Row>
      <Row label="Version">
        <span title="Changing the version lands in a later slice.">{mig.version}</span>
      </Row>
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
