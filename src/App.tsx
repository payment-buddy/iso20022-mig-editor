import { useEffect, useState } from "react"
import { ArrowClockwise, Database, SpinnerGap } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { RepositoryUpload } from "@/features/repository/RepositoryUpload"
import { loadERepository } from "@/core/storage/eRepositoryStore"
import type { ERepository } from "@/core/types/types"

type Gate =
  | { phase: "loading" }
  | { phase: "upload" }
  // re-uploading while a repo is already loaded; keep it so Cancel can restore it
  | { phase: "updating"; current: ERepository }
  | { phase: "ready"; repo: ERepository }

export function App() {
  const [gate, setGate] = useState<Gate>({ phase: "loading" })

  useEffect(() => {
    let active = true
    loadERepository()
      .then((repo) => {
        if (!active) return
        setGate(repo ? { phase: "ready", repo } : { phase: "upload" })
      })
      .catch((err) => {
        console.error("Failed to read stored e-Repository:", err)
        if (active) setGate({ phase: "upload" })
      })
    return () => {
      active = false
    }
  }, [])

  if (gate.phase === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <SpinnerGap className="size-6 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">Loading…</span>
      </div>
    )
  }

  if (gate.phase === "upload" || gate.phase === "updating") {
    return (
      <RepositoryUpload
        onLoaded={(repo) => setGate({ phase: "ready", repo })}
        onCancel={
          gate.phase === "updating"
            ? () => setGate({ phase: "ready", repo: gate.current })
            : undefined
        }
      />
    )
  }

  return (
    <Home repo={gate.repo} onUpdate={() => setGate({ phase: "updating", current: gate.repo })} />
  )
}

function Home({ repo, onUpdate }: { repo: ERepository; onUpdate: () => void }) {
  const areaCount = repo.businessAreas.length
  const messageCount = repo.businessAreas.reduce((n, a) => n + a.messages.length, 0)

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold tracking-tight">ISO 20022 MIG Editor</h1>
        <Button variant="outline" size="sm" onClick={onUpdate}>
          <ArrowClockwise data-icon="inline-start" aria-hidden />
          Update e-Repository
        </Button>
      </header>

      <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm">
        <Database className="size-5 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-medium">e-Repository loaded</p>
          <p className="text-muted-foreground">
            {areaCount} business area{areaCount === 1 ? "" : "s"} · {messageCount} message
            {messageCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Browser, message explorer and MIG editor land in the next phases.
      </p>
    </div>
  )
}

export default App
