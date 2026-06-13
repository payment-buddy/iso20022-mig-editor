import { useEffect, useState } from "react"
import { resolveMessage } from "@/core/erepository/resolveMessage"
import { getMigKey } from "@/core/mig/migKey"
import { loadAllMigs, saveMig } from "@/core/storage/migStore"
import type { ERepository, MessageImplementationGuide } from "@/core/types/types"
import { hashFor } from "@/app/routes"
import { DetailPanel, ElementTree } from "@/features/repository/ElementTree"
import { MigMetadata } from "./MigMetadata"

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

  // Autosave: persist the edited MIG and reflect it in the loaded list. Name and
  // Version are read-only here, so the identity key is unchanged.
  const persist = (next: MessageImplementationGuide) => {
    setMig(next)
    setAllMigs((prev) => prev.map((m) => (getMigKey(m) === migKey ? next : m)))
    saveMig(next).catch((err) => console.error("Failed to save MIG:", err))
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

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          {resolved.current.name} · {mig.messageIdentifier}
        </p>
        <h1 className="text-base font-semibold tracking-tight">{mig.name}</h1>
      </div>

      <MigMetadata mig={mig} allMigs={allMigs} onChange={persist} />

      <ElementTree
        key={mig.messageIdentifier}
        root={root}
        ariaLabel={`${mig.name} structure`}
        renderDetail={() => (
          <DetailPanel label="Element details">
            <p className="text-sm text-muted-foreground">
              Select an element to edit its overrides. Inline editing lands in the next slice.
            </p>
          </DetailPanel>
        )}
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
