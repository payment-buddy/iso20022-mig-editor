import { Fragment, type ReactNode } from "react"
import {
  CaretRightIcon,
  DesktopIcon,
  GithubLogoIcon,
  HouseIcon,
  MoonIcon,
  SunIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"
import { breadcrumbsFor } from "./breadcrumbs"
import { hashFor, type Route } from "./routes"

/** Project source — opened from the header GitHub link. */
const GITHUB_URL = "https://github.com/payment-buddy/iso20022-mig-editor"

export function AppShell({ route, children }: { route: Route; children: ReactNode }) {
  const crumbs = breadcrumbsFor(route)

  return (
    <div className="flex min-h-svh flex-col">
      {/* Keyboard users can jump past the header/breadcrumbs to the page content. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:border focus:border-border focus:bg-background focus:px-3 focus:py-1.5 focus:text-sm focus:shadow-lg focus:ring-2 focus:ring-ring/40"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-10 flex h-12 items-center gap-3 border-b border-border bg-background px-4">
        <a
          href={hashFor({ name: "home" })}
          className="flex items-center gap-2 font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <HouseIcon className="size-4 text-muted-foreground" aria-hidden />
          ISO 20022 MIG Editor
        </a>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            asChild
            title="View source on GitHub"
            aria-label="View source on GitHub"
          >
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              <GithubLogoIcon aria-hidden />
            </a>
          </Button>
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
              {i > 0 && <CaretRightIcon className="size-3 text-muted-foreground" aria-hidden />}
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

      <main id="main-content" tabIndex={-1} className="min-h-0 flex-1 outline-none">
        {children}
      </main>
    </div>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const next = theme === "system" ? "light" : theme === "light" ? "dark" : "system"
  const Icon = theme === "system" ? DesktopIcon : theme === "light" ? SunIcon : MoonIcon

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
