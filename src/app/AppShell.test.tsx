// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ThemeProvider } from "@/components/theme-provider"
import { AppShell } from "./AppShell"
import type { Route } from "./routes"

// jsdom doesn't implement matchMedia, which ThemeProvider reads.
beforeAll(() => {
  vi.stubGlobal(
    "matchMedia",
    (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  )
})

function renderShell(route: Route) {
  return render(
    <ThemeProvider>
      <AppShell route={route}>
        <div>content</div>
      </AppShell>
    </ThemeProvider>,
  )
}

afterEach(cleanup)

describe("AppShell", () => {
  it("renders the header and content slot", () => {
    renderShell({ name: "home" })
    expect(screen.getByRole("link", { name: /ISO 20022 MIG Editor/i })).toHaveAttribute(
      "href",
      "#",
    )
    expect(screen.getByText("content")).toBeInTheDocument()
  })

  it("offers a skip-to-content link targeting the main landmark", () => {
    renderShell({ name: "home" })
    expect(screen.getByRole("link", { name: /skip to main content/i })).toHaveAttribute(
      "href",
      "#main-content",
    )
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content")
  })

  it("derives a linked breadcrumb trail with the current page non-linked", () => {
    renderShell({ name: "message", code: "pacs.008.001.08" })
    const nav = screen.getByRole("navigation", { name: /breadcrumb/i })
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute("href", "#")
    expect(within(nav).getByRole("link", { name: "e-Repository" })).toHaveAttribute(
      "href",
      "#browse",
    )
    const current = within(nav).getByText("pacs.008.001.08")
    expect(current).toHaveAttribute("aria-current", "page")
    expect(current.tagName).toBe("SPAN") // last crumb is not a link
  })

  it("does not render the update-repository action (it lives on the browser page)", () => {
    renderShell({ name: "home" })
    expect(
      screen.queryByRole("button", { name: /update e-repository/i }),
    ).not.toBeInTheDocument()
  })

  it("links to the project source on GitHub, next to the theme toggle (new tab)", () => {
    renderShell({ name: "home" })
    const link = screen.getByRole("link", { name: /view source on github/i })
    expect(link).toHaveAttribute("href", "https://github.com/payment-buddy/iso20022-mig-editor")
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noreferrer")
  })

  it("cycles the theme toggle system → light", async () => {
    renderShell({ name: "home" })
    const toggle = screen.getByRole("button", { name: /theme: system/i })
    await userEvent.click(toggle)
    expect(screen.getByRole("button", { name: /theme: light/i })).toBeInTheDocument()
  })
})
