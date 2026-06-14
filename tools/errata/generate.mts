// Errata generator (offline tooling — NOT part of the app bundle).
//
// Reuses the app's repository parser, constraint-expression transpiler, code-set
// resolver, and DSL validators to turn the official ISO 20022 e-Repository's XML
// rule expressions into the app's DSL, per message. Because it runs offline with
// the full schema in hand, it does the schema-aware occurrence-marker strip the
// runtime transpiler deliberately omits: `[1]`/`[*]` on any maxOccurs==1 element
// (anywhere in a path) is provably redundant and dropped.
//
//   npx tsx tools/errata/generate.mts [shortCodeOrIdentifier]   (default pacs.008)
//
// Output: a coverage summary on stdout + per-constraint entries in
// tools/errata/out/<identifier>.json.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { parseRepository } from "@/core/erepository/eRepository"
import { resolveMessage } from "@/core/erepository/resolveMessage"
import { rootPath } from "@/core/erepository/elementPath"
import {
  ruleDefinitionToDsl,
  buildCodeListResolver,
  parseExpression,
  validateExpressionPaths,
  resolveOperands,
} from "@/core/mig/expression"
import type { MessageElement } from "@/core/types/types"

const REPO_PATH = "eRepository/eRepository.iso20022"

/** Decode XML entities (the raw `expression`/`definition` attributes carry them). */
const unesc = (s: string): string =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&")

const attrsOf = (s: string): Record<string, string> =>
  Object.fromEntries([...s.matchAll(/([\w:]+)="(.*?)"/g)].map((m) => [m[1], m[2]]))

/** Map (constraint name + definition) → its raw XML expression(s). */
function buildExprMap(raw: string): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const m of raw.matchAll(/<constraint\b([\s\S]*?)\/>/g)) {
    const a = attrsOf(m[1])
    if (!a.expression) continue
    const key = a.name
    const list = map.get(key) ?? []
    list.push(unesc(a.expression))
    map.set(key, list)
  }
  return map
}

// Schema-aware operand resolution (ISO name → xmlTag, [1]/[*] strip on
// singletons) is shared with the runtime via `resolveOperands` from
// `@/core/mig/expression`.

type Attempt =
  | { ok: true; dsl: string; pathValid: boolean; pathErrors: string[] }
  | { ok: false; reason: string }

function transpileAt(
  owner: MessageElement,
  xml: string,
  resolve: (n: string) => string[] | undefined,
): Attempt {
  const r = ruleDefinitionToDsl(resolveOperands(owner, xml), { resolveCodeList: resolve })
  if (!r.ok) return { ok: false, reason: r.reason }
  const parsed = parseExpression(r.dsl)
  if (!parsed.ok) return { ok: false, reason: "produced invalid DSL" }
  const errs = validateExpressionPaths(parsed.ast, owner)
  return { ok: true, dsl: r.dsl, pathValid: errs.length === 0, pathErrors: errs.map((e) => e.message) }
}

type Entry = {
  xmlPath: string
  name: string
  definition: string
  status: "transpiled" | "path-unresolved" | "ambiguous" | "unsupported" | "missing"
  dsl?: string
  dsls?: string[]
  reason?: string
}

function processConstraint(
  owner: MessageElement,
  xmlPath: string,
  name: string,
  definition: string,
  exprMap: Map<string, string[]>,
  resolve: (n: string) => string[] | undefined,
): Entry {
  const base = { xmlPath, name, definition }
  const candidates = exprMap.get(name)
  if (!candidates || candidates.length === 0) return { ...base, status: "missing" }

  const attempts = candidates.map((x) => transpileAt(owner, x, resolve))
  const valid = attempts.filter((a): a is Extract<Attempt, { ok: true }> => a.ok && a.pathValid)
  if (valid.length) {
    const distinct = [...new Set(valid.map((a) => a.dsl))]
    return distinct.length === 1
      ? { ...base, status: "transpiled", dsl: distinct[0] }
      : { ...base, status: "ambiguous", dsls: distinct }
  }
  const transpiled = attempts.find((a): a is Extract<Attempt, { ok: true }> => a.ok)
  if (transpiled) {
    return { ...base, status: "path-unresolved", dsl: transpiled.dsl, reason: transpiled.pathErrors[0] }
  }
  const failed = attempts.find((a): a is Extract<Attempt, { ok: false }> => !a.ok)
  return { ...base, status: "unsupported", reason: failed?.reason }
}

function main() {
  const code = process.argv[2] ?? "pacs.008"
  const raw = readFileSync(REPO_PATH, "utf8")
  const exprMap = buildExprMap(raw)

  return parseRepository(new File([Buffer.from(raw)], "eRepository.iso20022")).then((repo) => {
    const resolve = buildCodeListResolver(repo.codeSets ?? [])
    const r = resolveMessage(repo, code)
    if (!r) throw new Error(`message not found: ${code}`)

    const entries: Entry[] = []
    const seen = new Set<string>() // dedupe constraint sites by xmlPath+name
    const walk = (e: MessageElement, path: string, ancestors: Set<string>) => {
      for (const c of e.constraints) {
        const key = path + " " + c.name
        if (!seen.has(key)) {
          seen.add(key)
          entries.push(processConstraint(e, path, c.name, c.definition, exprMap, resolve))
        }
      }
      if (ancestors.has(e.id)) return
      const next = new Set(ancestors).add(e.id)
      for (const child of e.elements) walk(child, path + "/" + child.xmlTag, next)
    }
    walk(r.current.rootElement, rootPath(r.current.rootElement), new Set())

    // --- report ---
    const by = (s: Entry["status"]) => entries.filter((e) => e.status === s)
    const uniq = (es: Entry[]) => new Set(es.map((e) => e.definition)).size
    const order: Entry["status"][] = ["transpiled", "path-unresolved", "ambiguous", "unsupported", "missing"]
    console.log(`\n${r.current.identifier}  —  ${entries.length} constraint sites, ${uniq(entries)} unique definitions\n`)
    for (const s of order) {
      const es = by(s)
      if (es.length) console.log(`  ${String(es.length).padStart(4)} ${s.padEnd(16)} (${uniq(es)} unique defs)`)
    }
    const done = by("transpiled").length
    console.log(`\n  => ${done}/${entries.length} sites transpiled (${((100 * done) / entries.length).toFixed(0)}%)`)

    mkdirSync("tools/errata/out", { recursive: true })
    const outPath = `tools/errata/out/${r.current.identifier}.json`
    writeFileSync(outPath, JSON.stringify(entries, null, 2))
    console.log(`  wrote ${outPath}\n`)
  })
}

await main()
