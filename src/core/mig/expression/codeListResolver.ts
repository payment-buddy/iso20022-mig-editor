// Resolve an ISO 20022 code-set name to its member wire values (`codeName`s),
// for expanding `WithInList`/`NotWithInList` rules in `ruleDefinitionToDsl`.
//
// The indirection (confirmed against the official repository): a `WithInList`
// names a *validation-rule* code-set — a rule-specific subset such as
// `ValidationRuleReceived1Code` — whose `<code>` children carry only a `name`
// ("Received"), NOT the wire value. The wire value ("RCVD") lives on the
// code-set the entry was traced from (its `trace` xmi:id → "real" code-set),
// matched by `name`. Every WithInList-referenced set in the repository resolves
// this way; none carry `codeName` directly.
//
// This is pure and decoupled: callers build the `RepoCodeSet[]` index from the
// raw repository (the in-app `Code` model drops `name`/`trace`, so it can't be
// the source) and pass the returned function as `resolveCodeList`.

/** One `<code>` of a code-set. `codeName` is the wire value, absent on validation sets. */
export interface RepoCode {
  name: string
  codeName?: string
}

/** A `<topLevelDictionaryEntry xsi:type="iso20022:CodeSet">`. */
export interface RepoCodeSet {
  /** `xmi:id` — the target of another set's `trace`. */
  id: string
  name: string
  /** `xmi:id` of the code-set this one was traced/derived from. */
  trace?: string
  codes: RepoCode[]
}

/**
 * Build a resolver `codeSetName → wire codeNames`. Returns `undefined` for an
 * unknown set, or when any member's wire value can't be resolved (fail closed —
 * a half-resolved list would yield silently-wrong DSL).
 */
export function buildCodeListResolver(
  codeSets: RepoCodeSet[],
): (codeSetName: string) => string[] | undefined {
  const byId = new Map<string, RepoCodeSet>()
  const byName = new Map<string, RepoCodeSet>()
  for (const cs of codeSets) {
    if (cs.id) byId.set(cs.id, cs)
    if (cs.name) byName.set(cs.name, cs)
  }

  return (codeSetName) => {
    const set = byName.get(codeSetName)
    if (!set || set.codes.length === 0) return undefined
    const traced = set.trace ? byId.get(set.trace) : undefined

    const out: string[] = []
    for (const code of set.codes) {
      // Prefer a directly-attached wire value; else borrow it from the traced
      // set's same-named code (the validation-set case).
      const wire =
        code.codeName ?? traced?.codes.find((t) => t.name === code.name)?.codeName
      if (!wire) return undefined
      out.push(wire)
    }
    return out
  }
}
