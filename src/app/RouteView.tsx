import { ERepositoryBrowser } from "@/features/repository/ERepositoryBrowser"
import { MessageExplorer } from "@/features/repository/MessageExplorer"
import { MigHome } from "@/features/mig/MigHome"
import { MigEditor } from "@/features/mig/MigEditor"
import { MigHistory } from "@/features/mig/MigHistory"
import { MigCompare } from "@/features/mig/MigCompare"
import { MigMerge } from "@/features/mig/MigMerge"
import { MigTrash } from "@/features/mig/MigTrash"
import type { ERepository } from "@/core/types/types"
import type { Route } from "./routes"

/** Maps the current route to its screen. */
export function RouteView({
  route,
  repo,
  onUpdateRepository,
}: {
  route: Route
  repo: ERepository
  onUpdateRepository: () => void
}) {
  switch (route.name) {
    case "home":
      return <MigHome repo={repo} />
    case "browse":
      return (
        <ERepositoryBrowser
          repo={repo}
          onUpdateRepository={onUpdateRepository}
        />
      )
    case "message":
      return (
        <MessageExplorer
          repo={repo}
          code={route.code}
          selectPath={route.path}
        />
      )
    case "mig":
      // Keyed so switching MIGs remounts with a fresh load state.
      return (
        <MigEditor
          key={route.key}
          migKey={route.key}
          repo={repo}
          selectPath={route.path}
        />
      )
    case "history":
      return <MigHistory key={route.key} migKey={route.key} repo={repo} />
    case "compare":
      return <MigCompare keyA={route.a} keyB={route.b} repo={repo} />
    case "merge":
      return <MigMerge key={route.key} targetKey={route.key} repo={repo} />
    case "trash":
      return <MigTrash />
    case "reset":
      // Intercepted in App before the repo gate; never rendered here.
      return null
  }
}
