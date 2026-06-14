import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// These PWA sidecars are static files (not bundled), so guard them with a plain
// read-from-disk test — they previously shipped broken (stub SW, dead
// registration check, external icon URLs).
const read = (p: string) => readFileSync(p, "utf8")

describe("PWA assets", () => {
  it("manifest is valid, self-contained, and relative", () => {
    const manifest = JSON.parse(read("public/manifest.json"))
    expect(manifest.name).toBeTruthy()
    expect(manifest.display).toBe("standalone")
    expect(manifest.start_url).toBeTruthy()
    expect(manifest.icons.length).toBeGreaterThan(0)
    // No external icon URLs — they wouldn't load offline.
    for (const icon of manifest.icons) {
      expect(icon.src).not.toMatch(/^https?:/)
    }
  })

  it("index.html registers the service worker without the dead protocol check", () => {
    const html = read("index.html")
    expect(html).toContain("serviceWorker")
    expect(html).toMatch(/\.register\(['"]sw\.js['"]\)/)
    expect(html).toContain('href="manifest.json"')
    // Regression: the old guard `protocol === 'https'` is always false.
    expect(html).not.toContain("=== 'https'")
  })

  it("service worker actually caches (not the no-op stub)", () => {
    const sw = read("public/sw.js")
    expect(sw).toMatch(/addEventListener\(['"]install['"]/)
    expect(sw).toMatch(/addEventListener\(['"]fetch['"]/)
    expect(sw).toContain("caches.open")
  })

  it("ships a self-hosted icon", () => {
    expect(read("public/icon.svg")).toContain("<svg")
  })
})
