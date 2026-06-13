import type { ERepository } from "@/core/types/types"
import { hashFor, type Route } from "./routes"

/**
 * Maps the current route to its screen. The screens themselves are placeholders
 * until their phases land (MIG list, browser, explorer, editor, compare); the
 * routing, breadcrumbs, and links are fully wired now.
 */
export function RouteView({ route, repo }: { route: Route; repo: ERepository }) {
  switch (route.name) {
    case "home":
      return <HomePlaceholder repo={repo} />
    case "browse":
      return <Placeholder title="Business Area Browser" note="Lands in Phase 1." />
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

function HomePlaceholder({ repo }: { repo: ERepository }) {
  const messageCount = repo.businessAreas.reduce((n, a) => n + a.messages.length, 0)
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <div>
        <h1 className="text-base font-semibold tracking-tight">Your MIGs</h1>
        <p className="text-sm text-muted-foreground">
          The MIG list lands in Phase 1. For now you can{" "}
          <a
            href={hashFor({ name: "browse" })}
            className="text-primary underline-offset-4 hover:underline"
          >
            browse the e-Repository
          </a>
          .
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        {repo.businessAreas.length} business areas · {messageCount} messages loaded.
      </p>
    </div>
  )
}

function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-2 p-6">
      <h1 className="text-base font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{note}</p>
    </div>
  )
}
