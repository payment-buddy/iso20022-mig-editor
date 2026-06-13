import { Fragment, type ReactNode } from "react"
import { CaretRight, Desktop, House, Moon, Sun } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"
import { breadcrumbsFor } from "./breadcrumbs"
import { hashFor, type Route } from "./routes"

export function AppShell({ route, children }: { route: Route; children: ReactNode }) {
  const crumbs = breadcrumbsFor(route)

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 flex h-12 items-center gap-3 border-b border-border bg-background px-4">
        <a
          href={hashFor({ name: "home" })}
          className="flex items-center gap-2 font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <House className="size-4 text-muted-foreground" aria-hidden />
          ISO 20022 MIG Editor
        </a>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      <nav
        aria-label="Breadcrumb"
        className="flex h-9 items-center gap-1 border-b border-border px-4 text-xs"
      >
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <Fragment key={i}>
              {i > 0 && <CaretRight className="size-3 text-muted-foreground" aria-hidden />}
              {crumb.route && !isLast ? (
                <a
                  href={hashFor(crumb.route)}
                  className="text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  {crumb.label}
                </a>
              ) : (
                <span aria-current={isLast ? "page" : undefined} className="font-medium">
                  {crumb.label}
                </span>
              )}
            </Fragment>
          )
        })}
      </nav>

      <main className="min-h-0 flex-1">{children}</main>
    </div>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const next = theme === "system" ? "light" : theme === "light" ? "dark" : "system"
  const Icon = theme === "system" ? Desktop : theme === "light" ? Sun : Moon

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      title={`Theme: ${theme} (click for ${next})`}
      aria-label={`Theme: ${theme}. Switch to ${next}.`}
    >
      <Icon aria-hidden />
    </Button>
  )
}
