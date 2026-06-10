// Matching for the element-tree filter box.
//
// Two modes, chosen by the query itself so the common case is unchanged:
//   • an all-lowercase (or letter-free) query → case-insensitive substring, the
//     familiar default;
//   • a query containing an uppercase letter → IntelliJ-style "CamelHumps":
//     uppercase letters opt into matching word boundaries of the long PascalCase
//     ISO names. "InA" finds "InstructingAgent" and
//     "InstructedReimbursementAgentAccount"; it also works on the abbreviated
//     xmlTags ("InstgAgt" → humps Instg/Agt).
//
// Pure string logic, kept out of the component so it is unit-testable.

// One "hump": an uppercase-led word (PascalCase / acronym letter) or a leading
// lowercase/digit run. Splits both the candidate and the query the same way.
const HUMP = /[A-Z][a-z0-9]*|[a-z0-9]+/g

/**
 * CamelHumps subsequence match: every query segment must be a case-insensitive
 * prefix of a candidate hump, with humps consumed left-to-right (a subsequence,
 * so non-matching humps — including leading ones — may be skipped). Earliest-hump
 * greedy is optimal here because each segment/hump test is an independent prefix
 * check, so matching the earliest hump always leaves the most humps for the rest.
 */
function camelHumpMatch(text: string, query: string): boolean {
  const humps = text.match(HUMP) ?? []
  const segments = query.match(HUMP) ?? []
  if (segments.length === 0) return true

  let h = 0
  for (const segment of segments) {
    const needle = segment.toLowerCase()
    let found = false
    while (h < humps.length) {
      const hump = humps[h].toLowerCase()
      h++
      if (hump.startsWith(needle)) {
        found = true
        break
      }
    }
    if (!found) return false
  }
  return true
}

/**
 * Does `text` match the tree-filter `query`? `query` is the raw, trimmed,
 * original-case filter text (empty is handled by the caller and never reaches
 * here). An uppercase letter anywhere switches on CamelHumps matching; otherwise
 * it is a plain case-insensitive substring test.
 */
export function treeFilterMatch(text: string, query: string): boolean {
  if (!/[A-Z]/.test(query)) {
    return text.toLowerCase().includes(query.toLowerCase())
  }
  return camelHumpMatch(text, query)
}
