// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ERepository } from "@/core/types/types"
import { RepositoryUpload } from "./RepositoryUpload"

const parseRepository = vi.hoisted(() => vi.fn())
const saveERepository = vi.hoisted(() => vi.fn())

vi.mock("@/core/erepository/eRepository", () => ({ parseRepository }))
vi.mock("@/core/storage/eRepositoryStore", () => ({ saveERepository }))

const REPO: ERepository = { businessAreas: [] }

function makeFile(name: string): File {
  return new File(["<model/>"], name, { type: "application/xml" })
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("RepositoryUpload", () => {
  it("parses, persists, and reports a valid file", async () => {
    parseRepository.mockResolvedValue(REPO)
    saveERepository.mockResolvedValue(undefined)
    const onLoaded = vi.fn()
    render(<RepositoryUpload onLoaded={onLoaded} />)

    const input = screen.getByLabelText<HTMLInputElement>("e-Repository file")
    await userEvent.upload(input, makeFile("repo.iso20022"))

    await waitFor(() => expect(onLoaded).toHaveBeenCalledWith(REPO))
    expect(parseRepository).toHaveBeenCalledOnce()
    expect(saveERepository).toHaveBeenCalledWith(REPO)
  })

  it("rejects files with the wrong extension before parsing", async () => {
    const onLoaded = vi.fn()
    render(<RepositoryUpload onLoaded={onLoaded} />)

    // applyAccept: false mirrors drag-and-drop, which bypasses the accept filter
    await userEvent.upload(
      screen.getByLabelText("e-Repository file"),
      makeFile("notes.txt"),
      {
        applyAccept: false,
      }
    )

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /not a .iso20022 or .zip file/i
    )
    expect(parseRepository).not.toHaveBeenCalled()
    expect(onLoaded).not.toHaveBeenCalled()
  })

  it("surfaces a parse failure as an error and does not report success", async () => {
    parseRepository.mockRejectedValue(new Error("bad xml"))
    const onLoaded = vi.fn()
    render(<RepositoryUpload onLoaded={onLoaded} />)

    await userEvent.upload(
      screen.getByLabelText("e-Repository file"),
      makeFile("repo.zip")
    )

    expect(await screen.findByRole("alert")).toHaveTextContent(/bad xml/i)
    expect(saveERepository).not.toHaveBeenCalled()
    expect(onLoaded).not.toHaveBeenCalled()
  })

  it("shows a Cancel affordance only in re-upload mode", async () => {
    const { rerender } = render(<RepositoryUpload onLoaded={vi.fn()} />)
    expect(
      screen.queryByRole("button", { name: /cancel/i })
    ).not.toBeInTheDocument()

    const onCancel = vi.fn()
    rerender(<RepositoryUpload onLoaded={vi.fn()} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
