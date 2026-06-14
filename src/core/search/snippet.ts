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
 *
 * An edge space in `query` anchors a word boundary (see `matchesQuery`): the
 * match is located against the value wrapped in sentinel spaces, but only the
 * trimmed word — never the edge spaces — is highlighted.
 */
export function makeSnippet(
  value: string,
  query: string,
  window = WINDOW
): Snippet {
  const q = query.toLowerCase()
  const lower = value.toLowerCase()
  // Locate the boundary-correct match in the sentinel-wrapped value, then
  // highlight just the trimmed word at that position in the original value.
  const token = q.trim()
  const at = token ? (" " + lower + " ").indexOf(q) : -1
  const i = at === -1 ? -1 : lower.indexOf(token, Math.max(0, at - 1))
  if (i === -1) {
    const head = value.slice(0, window * 2)
    return {
      before: head + (value.length > head.length ? "…" : ""),
      match: "",
      after: "",
    }
  }
  const start = Math.max(0, i - window)
  const end = Math.min(value.length, i + token.length + window)
  return {
    before: (start > 0 ? "…" : "") + value.slice(start, i),
    match: value.slice(i, i + token.length),
    after: value.slice(i + token.length, end) + (end < value.length ? "…" : ""),
  }
}
