import { ERepositoryBrowser } from "@/features/repository/ERepositoryBrowser"
import { MigHome } from "@/features/mig/MigHome"
import type { ERepository } from "@/core/types/types"
import type { Route } from "./routes"

/**
 * Maps the current route to its screen. The screens themselves are placeholders
 * until their phases land (MIG list, browser, explorer, editor, compare); the
 * routing, breadcrumbs, and links are fully wired now.
 */
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
      return <MigHome />
    case "browse":
      return <ERepositoryBrowser repo={repo} onUpdateRepository={onUpdateRepository} />
    case "message":
      return <Placeholder title={`Message: ${route.code}`} note="Explorer lands in Phase 1." />
    case "mig":
      return <Placeholder title={`MIG: ${route.key}`} note="Editor lands in Phase 1." />
    case "compare":
      return (
        <Placeholder
          title={`Compare: ${route.a} ↔ ${route.b}`}
          note="Semantic compare lands in Phase 4."
        />
      )
  }
}

function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-2 p-6">
      <h1 className="text-base font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{note}</p>
    </div>
  )
}
