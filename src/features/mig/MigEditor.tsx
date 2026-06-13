import { useEffect, useState } from "react"
import { resolveMessage } from "@/core/erepository/resolveMessage"
import { loadMig } from "@/core/storage/migStore"
import type { ERepository, MessageImplementationGuide } from "@/core/types/types"
import { hashFor } from "@/app/routes"
import { DetailPanel, ElementTree } from "@/features/repository/ElementTree"

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; mig: MessageImplementationGuide }

/**
 * MIG Editor (FUNCTIONALITY §5.7). First slice: load the MIG by key, resolve its
 * message in the e-Repository, and show the element tree. The editable metadata
 * block and the inline-edit detail panel land in later slices.
 */
export function MigEditor({ migKey, repo }: { migKey: string; repo: ERepository }) {
  const [state, setState] = useState<LoadState>({ status: "loading" })

  useEffect(() => {
    let active = true
    loadMig(migKey)
      .then((mig) => {
        if (!active) return
        setState(mig ? { status: "ready", mig } : { status: "missing" })
      })
      .catch((err) => {
        console.error("Failed to load MIG:", err)
        if (active) setState({ status: "missing" })
      })
    return () => {
      active = false
    }
  }, [migKey])

  if (state.status === "loading") {
    return <Notice title="Loading MIG…" />
  }

  if (state.status === "missing") {
    return (
      <Notice title="MIG not found">
        No MIG is stored under “{migKey}”. It may have been deleted. Return to{" "}
        <Home /> to see your MIGs.
      </Notice>
    )
  }

  const { mig } = state
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
        <p className="text-xs text-muted-foreground">{resolved.current.name}</p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-base font-semibold tracking-tight">{mig.name}</h1>
          <code className="rounded-sm bg-muted px-1 text-[0.625rem] text-muted-foreground">
            v{mig.version}
          </code>
          <code className="rounded-sm bg-muted px-1 text-[0.625rem] text-muted-foreground">
            {mig.messageIdentifier}
          </code>
        </div>
      </div>

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
