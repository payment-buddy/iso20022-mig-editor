import { useEffect, useRef } from "react"

/**
 * Keyboard navigation for the vertical list of element cards on the Compare and
 * Merge screens: `j`/`k` (or `↑`/`↓`) step focus between cards. The panel is
 * auto-focused on mount so the keys work immediately — without the user having
 * to click into the table first.
 *
 * Wire it up: put `ref={containerRef}`, `tabIndex={-1}`, `onKeyDown`, and an
 * `outline-none` class on the wrapping element, and register each card with
 * `ref={(el) => { cardRefs.current[i] = el }}`.
 */
export function useDiffCardNav() {
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    // preventScroll: focusing shouldn't yank the page down to the table.
    containerRef.current?.focus({ preventScroll: true })
  }, [])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const dir =
      e.key === "j" || e.key === "ArrowDown"
        ? 1
        : e.key === "k" || e.key === "ArrowUp"
          ? -1
          : 0
    if (dir === 0) return
    e.preventDefault()
    const cards = cardRefs.current.filter(Boolean) as HTMLElement[]
    if (cards.length === 0) return
    const at = cards.findIndex((c) => c === document.activeElement)
    const next =
      cards[Math.max(0, Math.min(cards.length - 1, (at < 0 ? -1 : at) + dir))]
    next?.focus()
    next?.scrollIntoView({ block: "nearest" })
  }

  return { containerRef, cardRefs, onKeyDown }
}
