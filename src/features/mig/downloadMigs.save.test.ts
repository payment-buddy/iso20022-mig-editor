// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import type { MessageImplementationGuide } from "@/core/types/types"
import { downloadMigs } from "./downloadMigs"

function mig(name: string, version: string): MessageImplementationGuide {
  return {
    name,
    version,
    messageIdentifier: "pacs.008.001.08",
    elementOverrides: {},
  }
}

const win = window as unknown as { showSaveFilePicker?: unknown }

afterEach(() => {
  delete win.showSaveFilePicker
  vi.restoreAllMocks()
})

describe("downloadMigs", () => {
  it("downloads via an anchor link with the canonical filename", async () => {
    URL.createObjectURL = vi.fn(() => "blob:fake")
    URL.revokeObjectURL = vi.fn()
    let downloadedName = ""
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadedName = this.download
      })

    await downloadMigs([mig("A", "1")])

    expect(click).toHaveBeenCalled()
    expect(downloadedName).toBe("A-1.yaml")
  })

  it("uses the download manager even when the File System Access API exists", async () => {
    // The picker would skip download history, so we deliberately ignore it.
    const picker = vi.fn()
    win.showSaveFilePicker = picker
    URL.createObjectURL = vi.fn(() => "blob:fake")
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    await downloadMigs([mig("A", "1")])

    expect(picker).not.toHaveBeenCalled()
  })
})
