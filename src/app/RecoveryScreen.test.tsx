// @vitest-environment jsdom
import "fake-indexeddb/auto"
import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as db from "@/core/storage/db"
import { saveMig } from "@/core/storage/migStore"
import { downloadMigs } from "@/features/mig/downloadMigs"
import { reloadPage } from "@/lib/reload"
import type { MessageImplementationGuide } from "@/core/types/types"
import { RecoveryScreen } from "./RecoveryScreen"

// The download side-effect (and jsdom's missing URL.createObjectURL) is out of scope.
vi.mock("@/features/mig/downloadMigs", () => ({ downloadMigs: vi.fn() }))
vi.mock("@/lib/reload", () => ({ reloadPage: vi.fn() }))

const mig = (name: string): MessageImplementationGuide => ({
  name,
  version: "1.0",
  messageIdentifier: "pacs.008.001.08",
  elementOverrides: {},
})

afterEach(async () => {
  cleanup()
  await db.deleteDatabase()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe("RecoveryScreen", () => {
  it("explains the failure and shows the error detail", () => {
    render(<RecoveryScreen error={new Error("QuotaExceededError")} />)
    expect(screen.getByRole("heading", { name: /couldn.t open local storage/i })).toBeInTheDocument()
    expect(screen.getByText("QuotaExceededError")).toBeInTheDocument()
  })

  it("downloads any readable MIGs as a backup", async () => {
    await saveMig(mig("A"))
    await saveMig(mig("B"))
    render(<RecoveryScreen error={new Error("boom")} />)

    await userEvent.click(screen.getByRole("button", { name: /download my migs/i }))

    await waitFor(() => expect(downloadMigs).toHaveBeenCalledTimes(1))
    expect(vi.mocked(downloadMigs).mock.calls[0][0]).toHaveLength(2)
    expect(await screen.findByText(/backup downloaded/i)).toBeInTheDocument()
  })

  it("reports when there are no MIGs to back up", async () => {
    render(<RecoveryScreen error={new Error("boom")} />)
    await userEvent.click(screen.getByRole("button", { name: /download my migs/i }))
    expect(await screen.findByText(/no migs could be read/i)).toBeInTheDocument()
    expect(downloadMigs).not.toHaveBeenCalled()
  })

  it("resets (deletes the database) and reloads after confirming", async () => {
    const del = vi.spyOn(db, "deleteDatabase").mockResolvedValue()
    render(<RecoveryScreen error={new Error("boom")} />)

    await userEvent.click(screen.getByRole("button", { name: /reset & start fresh/i }))
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(within(dialog).getByRole("button", { name: /delete everything/i }))

    await waitFor(() => expect(del).toHaveBeenCalledTimes(1))
    expect(reloadPage).toHaveBeenCalled()
  })
})
