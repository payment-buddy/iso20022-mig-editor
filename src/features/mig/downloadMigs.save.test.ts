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
  it("saves via showSaveFilePicker when available (no anchor fallback)", async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    const close = vi.fn().mockResolvedValue(undefined)
    const createWritable = vi.fn().mockResolvedValue({ write, close })
    const picker = vi.fn().mockResolvedValue({ createWritable })
    win.showSaveFilePicker = picker
    const createObjectURL = vi.fn()
    URL.createObjectURL = createObjectURL

    await downloadMigs([mig("EPC", "1.0")])

    expect(picker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: "EPC-1.0.yaml" })
    )
    expect(write).toHaveBeenCalledWith(expect.stringContaining("name: EPC"))
    expect(close).toHaveBeenCalled()
    expect(createObjectURL).not.toHaveBeenCalled() // didn't fall back
  })

  it("falls back to an anchor download when the picker is unavailable", async () => {
    delete win.showSaveFilePicker
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

  it("swallows the user cancelling the save dialog (AbortError)", async () => {
    win.showSaveFilePicker = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("cancelled"), { name: "AbortError" })
      )
    const createObjectURL = vi.fn()
    URL.createObjectURL = createObjectURL
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(downloadMigs([mig("A", "1")])).resolves.toBeUndefined()
    expect(createObjectURL).not.toHaveBeenCalled() // picker was used; no fallback
    expect(errorSpy).not.toHaveBeenCalled() // cancel is not an error
  })
})
