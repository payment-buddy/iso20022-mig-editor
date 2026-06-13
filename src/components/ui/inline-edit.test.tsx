// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { InlineEdit } from "./inline-edit"

afterEach(cleanup)

describe("InlineEdit", () => {
  it("enters edit mode via the pencil and commits on blur", async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(<InlineEdit value="" onCommit={onCommit} ariaLabel="Note" />)

    await user.click(screen.getByRole("button", { name: "Edit Note" }))
    await user.type(screen.getByRole("textbox", { name: "Note" }), "hi")
    await user.tab()

    expect(onCommit).toHaveBeenCalledWith("hi")
  })

  it("cancels on Escape without committing", async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(<InlineEdit value="orig" onCommit={onCommit} ariaLabel="Note" />)

    await user.click(screen.getByRole("button", { name: "Edit Note" }))
    await user.type(screen.getByRole("textbox", { name: "Note" }), "x")
    await user.keyboard("{Escape}")

    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.queryByRole("textbox", { name: "Note" })).not.toBeInTheDocument()
  })

  it("collapses a long value behind a Show more/less toggle", async () => {
    const user = userEvent.setup()
    render(
      <InlineEdit value={"x".repeat(500)} onCommit={vi.fn()} ariaLabel="Description" multiline />,
    )

    await user.click(screen.getByRole("button", { name: "Show more" }))
    expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Show less" }))
    expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument()
  })

  it("does not show a toggle for short values", () => {
    render(<InlineEdit value="short" onCommit={vi.fn()} ariaLabel="Description" multiline />)
    expect(screen.queryByRole("button", { name: /show (more|less)/i })).not.toBeInTheDocument()
  })
})
