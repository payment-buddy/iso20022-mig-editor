// Revision history model. A MIG's history is an
// append-only list of full snapshots, each with a timestamp and a one-line change
// summary (computed once, against the previous revision). Pure — persistence is
// `core/storage/revisionStore.ts`, snapshotting is the editor's debounced hook.

import { compareMigs } from "./compareMigs"
import type { MessageImplementationGuide } from "@/core/types/types"

export type Revision = {
  /** Stable id within a MIG's history (timestamp + index). */
  id: string
  /** Snapshot time (`Date.now()`). */
  at: number
  /** Full MIG state at this point. */
  mig: MessageImplementationGuide
  /** One-line summary of what changed vs the previous revision. */
  summary: string
}

const sameNames = (a: string[] = [], b: string[] = []) =>
  a.length === b.length && a.every((x, i) => x === b[i])

/**
 * A concise summary of how `next` differs from `prev`: metadata touches
 * (rename / description / parent / annotation names) plus override-path counts
 * (e.g. `"2 changed, 1 added"`). `"No changes"` when identical.
 */
export function summarizeChange(
  prev: MessageImplementationGuide,
  next: MessageImplementationGuide
): string {
  const parts: string[] = []
  if (prev.name !== next.name || prev.version !== next.version)
    parts.push("renamed")
  if ((prev.description ?? "") !== (next.description ?? ""))
    parts.push("description")
  if ((prev.parentMIG ?? "") !== (next.parentMIG ?? "")) parts.push("parent")
  if (
    !sameNames(prev.elementAnnotationNames, next.elementAnnotationNames) ||
    !sameNames(prev.constraintAnnotationNames, next.constraintAnnotationNames)
  ) {
    parts.push("annotations")
  }

  const counts = { changed: 0, added: 0, removed: 0 }
  for (const p of compareMigs(prev, next).paths) counts[p.kind]++
  const overrides: string[] = []
  if (counts.changed) overrides.push(`${counts.changed} changed`)
  if (counts.added) overrides.push(`${counts.added} added`)
  if (counts.removed) overrides.push(`${counts.removed} removed`)
  if (overrides.length) parts.push(overrides.join(", "))

  return parts.length > 0 ? parts.join("; ") : "No changes"
}

/**
 * Append a snapshot of `mig` to a history list, returning a new list. The summary
 * is computed against the previous revision (or `"Initial"` for the first), or
 * taken from `summary` when given (e.g. a revert).
 */
export function appendRevision(
  revisions: Revision[],
  mig: MessageImplementationGuide,
  now: number,
  summary?: string
): Revision[] {
  const prev = revisions[revisions.length - 1]
  const rev: Revision = {
    id: `${now}-${revisions.length}`,
    at: now,
    mig,
    summary: summary ?? (prev ? summarizeChange(prev.mig, mig) : "Initial"),
  }
  return [...revisions, rev]
}
