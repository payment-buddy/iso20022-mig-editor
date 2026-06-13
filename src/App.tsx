import { useEffect, useState } from "react"
import { SpinnerGapIcon } from "@phosphor-icons/react"
import { AppShell } from "@/app/AppShell"
import { RouteView } from "@/app/RouteView"
import { useRoute } from "@/app/useRoute"
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
  const route = useRoute()

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
        <SpinnerGapIcon className="size-6 animate-spin text-muted-foreground" aria-hidden />
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
    <AppShell route={route}>
      <RouteView
        route={route}
        repo={gate.repo}
        onUpdateRepository={() => setGate({ phase: "updating", current: gate.repo })}
      />
    </AppShell>
  )
}

export default App
