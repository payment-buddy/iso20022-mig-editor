// Transpile an ISO 20022 official `RuleDefinition` constraint expression (an XML
// blob stored in the e-Repository's `expression` attribute) into this app's
// XPath-like DSL (see `ast.ts` / `parser.ts`).
//
// The source grammar is small and flat (mined from the official repository):
//
//   RuleDefinition
//     ├─ SimpleRule   → mustBe                         (unconditional)
//     └─ ComplexRule  → mustBe + onCondition           (onCondition ⟹ mustBe)
//
//   mustBe / onCondition := connector(AND|OR) + one-or-more BooleanRule
//   BooleanRule xsi:type ∈ {
//     Presence, Absence,                  // path only
//     EqualToValue, DifferentFromValue,   // path vs literal
//     EqualToNode,  DifferentFromNode,    // path vs path
//     WithInList,   NotWithInList,        // path vs code-set name  (needs resolver)
//   }
//
// Mapping:
//   Presence(p)            → p                    (a bare path is an existence test)
//   Absence(p)             → not(p)
//   Presence(X[n≥2])       → count(X) >= n        (leaf occurrence-count idiom)
//   Absence(X[n≥2])        → count(X) < n
//   EqualToValue(p, v)     → p = 'v'
//   DifferentFromValue     → p != 'v'
//   EqualToNode(p, q)      → p = q
//   EqualToNode(X[*]/p, X[1]/p) → all-equal(X/p)  (uniformity: every occurrence shares a value)
//   DifferentFromNode      → p != q
//   block of rules + AND   → r1 and r2 and …
//   block of rules + OR    → r1 or r2 or …
//   SimpleRule(mustBe)     → <mustBe>
//   ComplexRule(cond⟹must) → not(<cond>) or <must>   (no implication op in the DSL)
//
// FAIL CLOSED. A transpiler that emits plausible-but-wrong DSL is far more
// dangerous than one that declines — a silently wrong rule is undetectable. So
// anything not fully modelled is skipped with a reason rather than approximated:
//   • WithInList/NotWithInList — expanded to `(p = 'a' or p = 'b' …)` when a
//     `resolveCodeList` is supplied; skipped (fail closed) without one, since the
//     path-only DSL can't name a code-set.
//   • Index predicates — the DSL path grammar has no predicate syntax. In an
//     existence context (Presence/Absence) the provably-equivalent markers are
//     dropped: `[*]` (any occurrence) and a trailing leaf `[1]` (`Item[1]` exists
//     ⟺ `Item` exists). Everywhere else — a specific occurrence in a comparison,
//     a non-leaf `[1]`, or any higher index `[2]` — is skipped (see `dslPath`).
//   • Non-XML expressions (some are free text) and any unrecognised structure.
// As a final guard the emitted DSL is re-parsed with `parseExpression`; if it
// doesn't parse cleanly we skip rather than hand back broken output.

import sax from "sax"
import { parseExpression } from "./parser"

export type TranspileResult = { ok: true; dsl: string } | { ok: false; reason: string }

export interface TranspileOptions {
  /**
   * Resolve a code-set name (a `WithInList`/`NotWithInList` right operand) to its
   * member wire values. Without it — or when it returns `undefined` — membership
   * rules are skipped (fail closed). See `buildCodeListResolver`.
   */
  resolveCodeList?: (codeSetName: string) => string[] | undefined
}

interface XmlNode {
  name: string
  attrs: Record<string, string>
  children: XmlNode[]
  text: string
}

/** A boolean leaf rendered to DSL. `compound` is true for and/or joins, so a
 * caller knows to parenthesise it when nesting. */
interface Rendered {
  expr: string
  compound: boolean
}

const fail = (reason: string): TranspileResult => ({ ok: false, reason })

/** Parse the small XML blob into a node tree, or `null` if it isn't valid XML. */
function parseXml(xml: string): XmlNode | null {
  const root: XmlNode = { name: "#root", attrs: {}, children: [], text: "" }
  const stack: XmlNode[] = [root]
  let failed = false

  const parser = sax.parser(true) // strict — attribute names kept as-is
  parser.onerror = () => {
    failed = true
  }
  parser.onopentag = (t: sax.Tag) => {
    const node: XmlNode = {
      name: t.name,
      attrs: t.attributes as Record<string, string>,
      children: [],
      text: "",
    }
    stack[stack.length - 1].children.push(node)
    stack.push(node)
  }
  parser.onclosetag = () => {
    stack.pop()
  }
  parser.ontext = (txt: string) => {
    stack[stack.length - 1].text += txt
  }
  parser.oncdata = (txt: string) => {
    stack[stack.length - 1].text += txt
  }

  try {
    parser.write(xml).close()
  } catch {
    failed = true
  }
  if (failed) return null
  return root.children[0] ?? null
}

const child = (node: XmlNode, name: string): XmlNode | undefined =>
  node.children.find((c) => c.name === name)

/** Single-quote a DSL string literal, doubling embedded quotes. */
const quote = (value: string): string => `'${value.replace(/'/g, "''")}'`

/**
 * True iff `expr` is exactly a single `not( … )` whose opening paren matches the
 * final character — so peeling it is sound double-negation removal, not a mistaken
 * grab of `not(A) or B`. String literals (single-quoted, `''`-escaped) are skipped
 * so a `)` inside a value doesn't throw off the paren balance.
 */
function isSingleNot(expr: string): boolean {
  if (!expr.startsWith("not(")) return false
  let depth = 0
  let inStr = false
  for (let i = 3; i < expr.length; i++) {
    const c = expr[i]
    if (inStr) {
      if (c === "'") {
        if (expr[i + 1] === "'") i++ // escaped quote
        else inStr = false
      }
      continue
    }
    if (c === "'") inStr = true
    else if (c === "(") depth++
    else if (c === ")" && --depth === 0) return i === expr.length - 1
  }
  return false
}

/** Negate `expr`, collapsing `not(not(x))` to `x`. */
const negate = (expr: string): string => (isSingleNot(expr) ? expr.slice(4, -1) : `not(${expr})`)

/**
 * Convert an operand path (`/Status/Code`, `/Amt/@Ccy`) to a relative DSL path.
 * Returns `null` for forms the DSL can't represent (index predicates, empty).
 * Final shape is still re-validated by re-parsing the whole expression.
 *
 * `existence` enables two occurrence-marker drops that are sound *only* in an
 * existence context (Presence/Absence), where `¬∃ = ∀¬`:
 *   • `[*]` (any occurrence) — `not(Item[*]/X)` ≡ `not(Item/X)`.
 *   • a trailing leaf `[1]` — `Item[1]` exists ⟺ `Item` exists.
 * Neither holds in a comparison (`Item[*]/Ccy = 'EUR'` means *every* item, but
 * existential `Item/Ccy = 'EUR'` means *some*; `Item[1]/Ccy` names one specific
 * occurrence), so there the marker is left to fail the `[` check and skip the
 * rule. A non-leaf `[1]` (`A[1]/B`) or a higher index (`[2]`) is never dropped.
 */
function dslPath(raw: string | undefined, existence = false): string | null {
  if (raw == null) return null
  let p = raw.trim()
  if (p.startsWith("/")) p = p.slice(1)
  if (existence) p = p.replace(/\[\*\]/g, "").replace(/\[1\]$/, "")
  if (p === "" || p.includes("[")) return null
  return p
}

// A leaf occurrence index >= 2, e.g. `/X[2]`: present iff `count(X) >= n`, absent
// iff `count(X) < n`. Restricted to a single element step so the count is
// unambiguous regardless of parent cardinality; `[1]` is handled by `dslPath`'s
// existence strip.
function leafCardinality(raw: string | undefined): { base: string; n: number } | null {
  if (raw == null) return null
  let p = raw.trim()
  if (p.startsWith("/")) p = p.slice(1)
  const m = /^([A-Za-z_][\w.-]*)\[(\d+)\]$/.exec(p)
  if (!m) return null
  const n = Number(m[2])
  return n >= 2 ? { base: m[1], n } : null
}

// Uniformity: `X[*]/p` compared to `X[1]/p` (same path, differing only in the
// occurrence marker) asserts every occurrence shares one value → `all-equal(X/p)`.
function uniformityPath(l: string, r: string): string | null {
  const star = l.includes("[*]") ? l : r.includes("[*]") ? r : null
  if (!star) return null
  const other = star === l ? r : l
  if (star.replace(/\[\*\]/g, "[1]") !== other) return null
  return dslPath(star.replace(/\[\*\]/g, ""))
}

type Resolver = (codeSetName: string) => string[] | undefined

/** Expand a code-set membership to `(p = 'a' or p = 'b' …)`, negated for NOT-in. */
function expandList(left: string, codes: string[], negated: boolean): Rendered {
  const terms = codes.map((c) => `${left} = ${quote(c)}`).join(" or ")
  // not(...) self-groups; a single term needs no parens; a multi-term OR is
  // pre-grouped so callers treat it as atomic (compound:false).
  if (negated) return { expr: `not(${terms})`, compound: false }
  return { expr: codes.length === 1 ? terms : `(${terms})`, compound: false }
}

/** Render one `<BooleanRule>` to DSL, or `null` if unsupported. */
function renderRule(rule: XmlNode, resolve?: Resolver): Rendered | null {
  const type = rule.attrs["xsi:type"]
  const leftRaw = child(rule, "leftOperand")?.text

  switch (type) {
    case "Presence":
    case "Absence": {
      // A leaf index >= 2 is a cardinality test expressible with count().
      const card = leafCardinality(leftRaw)
      if (card) {
        const expr =
          type === "Presence"
            ? `count(${card.base}) >= ${card.n}`
            : `count(${card.base}) < ${card.n}`
        return { expr, compound: false }
      }
      // Existence context — `[*]` and a trailing leaf `[1]` are safe to drop
      // (see `dslPath`).
      const left = dslPath(leftRaw, true)
      if (!left) return null
      return { expr: type === "Presence" ? left : negate(left), compound: false }
    }
    case "EqualToValue":
    case "DifferentFromValue": {
      const left = dslPath(leftRaw)
      if (!left) return null
      const value = child(rule, "rightOperand")?.text
      if (value == null) return null
      const op = type === "EqualToValue" ? "=" : "!="
      return { expr: `${left} ${op} ${quote(value.trim())}`, compound: false }
    }
    case "EqualToNode": {
      const lr = (leftRaw ?? "").trim()
      const rr = (child(rule, "rightOperand")?.text ?? "").trim()
      const uniform = uniformityPath(lr, rr)
      if (uniform) return { expr: `all-equal(${uniform})`, compound: false }
      const left = dslPath(lr)
      const right = dslPath(rr)
      if (!left || !right) return null
      return { expr: `${left} = ${right}`, compound: false }
    }
    case "DifferentFromNode": {
      const left = dslPath(leftRaw)
      if (!left) return null
      const right = dslPath(child(rule, "rightOperand")?.text)
      if (!right) return null
      return { expr: `${left} != ${right}`, compound: false }
    }
    case "WithInList":
    case "NotWithInList": {
      // Membership compares a value to a list, so `[*]`/`[1]` aren't stripped.
      const left = dslPath(leftRaw)
      if (!left) return null
      const setName = child(rule, "rightOperand")?.text?.trim()
      const codes = setName && resolve ? resolve(setName) : undefined
      if (!codes || codes.length === 0) return null // fail closed without a resolver
      return expandList(left, codes, type === "NotWithInList")
    }
    default:
      // Anything new/unrecognised: not representable here.
      return null
  }
}

/** Render a `<mustBe>` / `<onCondition>` block (connector + BooleanRules). */
function renderBlock(block: XmlNode, resolve?: Resolver): Rendered | null {
  const rules = block.children.filter((c) => c.name === "BooleanRule")
  if (rules.length === 0) return null

  const parts: Rendered[] = []
  for (const r of rules) {
    const rendered = renderRule(r, resolve)
    if (!rendered) return null
    parts.push(rendered)
  }
  if (parts.length === 1) return parts[0]

  const connector = child(block, "connector")?.text.trim().toUpperCase()
  if (connector !== "AND" && connector !== "OR") return null
  const op = connector === "AND" ? "and" : "or"
  const joined = parts.map((p) => (p.compound ? `(${p.expr})` : p.expr)).join(` ${op} `)
  return { expr: joined, compound: true }
}

/** Transpile a `RuleDefinition` XML string to DSL, or skip with a reason. */
export function ruleDefinitionToDsl(xml: string, opts: TranspileOptions = {}): TranspileResult {
  const resolve = opts.resolveCodeList
  const root = parseXml(xml)
  if (!root) return fail("not valid XML")
  if (root.name !== "RuleDefinition") return fail(`expected <RuleDefinition>, got <${root.name}>`)

  const rule = root.children.find((c) => c.name === "SimpleRule" || c.name === "ComplexRule")
  if (!rule) return fail("no SimpleRule or ComplexRule")

  const mustBe = child(rule, "mustBe")
  if (!mustBe) return fail("no mustBe block")
  const must = renderBlock(mustBe, resolve)
  if (!must) return fail("mustBe uses an unsupported rule/connector")

  let dsl: string
  if (rule.name === "SimpleRule") {
    dsl = must.expr
  } else {
    const onCondition = child(rule, "onCondition")
    if (!onCondition) return fail("ComplexRule without onCondition")
    const cond = renderBlock(onCondition, resolve)
    if (!cond) return fail("onCondition uses an unsupported rule/connector")
    // cond ⟹ must  ≡  not(cond) or must. `negate` self-groups and collapses a
    // doubly-negated condition (an Absence onCondition), so `not(not(x))` → `x`.
    // The must side is wrapped only when compound, for readability.
    dsl = `${negate(cond.expr)} or ${must.compound ? `(${must.expr})` : must.expr}`
  }

  // Final guard: never emit DSL that doesn't parse cleanly.
  const check = parseExpression(dsl)
  if (!check.ok) return fail(`produced unparseable DSL: ${check.error.message}`)
  return { ok: true, dsl }
}
