import { useEffect, useState } from "react"
import { SpinnerGapIcon } from "@phosphor-icons/react"
import { AppShell } from "@/app/AppShell"
import { RecoveryScreen } from "@/app/RecoveryScreen"
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
  // IndexedDB couldn't be opened — show the recovery screen, not the upload flow
  // (which would just fail to persist again).
  | { phase: "error"; error: unknown }

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
        if (active) setGate({ phase: "error", error: err })
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

  if (gate.phase === "error") {
    return <RecoveryScreen error={gate.error} />
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
    <AppShell>
      <RouteView
        route={route}
        repo={gate.repo}
        onUpdateRepository={() => setGate({ phase: "updating", current: gate.repo })}
      />
    </AppShell>
  )
}

export default App
