import { useCallback, useEffect, useRef } from "react"
import { appendRevision, summarizeChange } from "@/core/mig/revisions"
import { loadRevisions, saveRevisions } from "@/core/storage/revisionStore"
import type { MessageImplementationGuide } from "@/core/types/types"

const DEBOUNCE_MS = 1500

/**
 * Auto-snapshot a MIG's edits into its revision history. Watches the live `mig`; after a burst of edits settles (~1.5 s idle)
 * it appends a revision, and it **flushes on unmount** so navigating away / re-
 * keying commits a pending burst. The state as first loaded is the baseline:
 * it's stored (as the first revision) only once a real edit lands, so a view-only
 * open creates nothing. Returns `flush` so the rename flow can commit before it
 * re-keys (then move the history with `renameRevisions`).
 */
export function useRevisionSnapshots(
  migKey: string,
  mig: MessageImplementationGuide | null,
): () => Promise<void> {
  const revisionsRef = useRef<Awaited<ReturnType<typeof loadRevisions>>>([])
  const loadedRef = useRef(false)
  const baselineRef = useRef<{ mig: MessageImplementationGuide; at: number } | null>(null)
  const lastRef = useRef<MessageImplementationGuide | null>(null)
  const latestRef = useRef<MessageImplementationGuide | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load any existing history once (the editor remounts per migKey).
  useEffect(() => {
    let active = true
    loadRevisions(migKey).then((revs) => {
      if (!active) return
      revisionsRef.current = revs
      loadedRef.current = true
      // Baseline only matters when there's no prior history.
      lastRef.current = revs.length > 0 ? revs[revs.length - 1].mig : (baselineRef.current?.mig ?? null)
    })
    return () => {
      active = false
    }
  }, [migKey])

  const flush = useCallback(async (): Promise<void> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const next = latestRef.current
    // Nothing loaded yet, nothing edited, or unchanged since the last snapshot.
    if (!loadedRef.current || !next || next === lastRef.current) return
    // A new object reference isn't a real change: an edit reverted within the
    // burst, or a value set back to its inherited baseline (which auto-clears the
    // override), lands here semantically identical to the last snapshot. Skip it
    // so the history never gains an empty "No changes" revision.
    if (lastRef.current && summarizeChange(lastRef.current, next) === "No changes") {
      lastRef.current = next
      return
    }
    let revs = revisionsRef.current
    if (revs.length === 0 && baselineRef.current) {
      revs = appendRevision(revs, baselineRef.current.mig, baselineRef.current.at)
    }
    revs = appendRevision(revs, next, Date.now())
    revisionsRef.current = revs
    lastRef.current = next
    await saveRevisions(migKey, revs)
  }, [migKey])

  // Track the latest mig; capture the baseline on first sight, debounce after.
  useEffect(() => {
    if (!mig) return
    latestRef.current = mig
    if (!baselineRef.current) {
      baselineRef.current = { mig, at: Date.now() }
      if (loadedRef.current && revisionsRef.current.length === 0) lastRef.current = mig
      return // baseline — don't snapshot the as-loaded state
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => void flush(), DEBOUNCE_MS)
  }, [mig, flush])

  // Commit a pending burst when the editor unmounts (navigate away / re-key).
  useEffect(() => () => void flush(), [flush])

  return flush
}
