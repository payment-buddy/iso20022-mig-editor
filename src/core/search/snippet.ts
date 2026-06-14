// A windowed, highlight-ready snippet around the first match of a query in a
// longer field value — keeps result rows short while showing *why* they matched.

/** Chars of surrounding context shown on each side of the matched span. */
const WINDOW = 48

/** A field value sliced around its first match: render `match` highlighted. */
export interface Snippet {
  /** Text before the match (prefixed with `…` when the value was clipped). */
  before: string
  /** The matched span, verbatim from the value (preserves original casing). */
  match: string
  /** Text after the match (suffixed with `…` when the value was clipped). */
  after: string
}

/**
 * Slice `value` to a window around the first case-insensitive occurrence of
 * `query`, splitting it into before/match/after for highlighting. With no match
 * (e.g. a blank query) it returns a clipped head of the value as `before`.
 */
export function makeSnippet(
  value: string,
  query: string,
  window = WINDOW
): Snippet {
  const q = query.toLowerCase()
  const i = q ? value.toLowerCase().indexOf(q) : -1
  if (i === -1) {
    const head = value.slice(0, window * 2)
    return {
      before: head + (value.length > head.length ? "…" : ""),
      match: "",
      after: "",
    }
  }
  const start = Math.max(0, i - window)
  const end = Math.min(value.length, i + q.length + window)
  return {
    before: (start > 0 ? "…" : "") + value.slice(start, i),
    match: value.slice(i, i + q.length),
    after: value.slice(i + q.length, end) + (end < value.length ? "…" : ""),
  }
}
