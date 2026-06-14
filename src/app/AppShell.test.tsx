// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import {afterEach, beforeAll, describe, expect, it, vi} from "vitest"
import {cleanup, render, screen} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {ThemeProvider} from "@/components/theme-provider"
import {AppShell} from "./AppShell"

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

function renderShell() {
  return render(
    <ThemeProvider>
      <AppShell>
        <div>content</div>
      </AppShell>
    </ThemeProvider>,
  )
}

afterEach(cleanup)

describe("AppShell", () => {
  it("renders the header and content slot", () => {
    renderShell()
    expect(screen.getByRole("link", { name: /ISO 20022 MIG Editor/i })).toHaveAttribute(
      "href",
      "#",
    )
    expect(screen.getByText("content")).toBeInTheDocument()
  })

  it("offers a skip-to-content link targeting the main landmark", () => {
    renderShell()
    expect(screen.getByRole("link", { name: /skip to main content/i })).toHaveAttribute(
      "href",
      "#main-content",
    )
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content")
  })

  it("does not render the update-repository action (it lives on the browser page)", () => {
    renderShell()
    expect(
      screen.queryByRole("button", { name: /update e-repository/i }),
    ).not.toBeInTheDocument()
  })

  it("links to the project source on GitHub, next to the theme toggle (new tab)", () => {
    renderShell()
    const link = screen.getByRole("link", { name: /view source on github/i })
    expect(link).toHaveAttribute("href", "https://github.com/payment-buddy/iso20022-mig-editor")
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noreferrer")
  })

  it("cycles the theme toggle system → light", async () => {
    renderShell()
    const toggle = screen.getByRole("button", { name: /theme: system/i })
    await userEvent.click(toggle)
    expect(screen.getByRole("button", { name: /theme: light/i })).toBeInTheDocument()
  })
})
