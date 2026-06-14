// Message-Definition search.
//
// The e-Repository carries every historical version of each message (≈3.3M
// element nodes across all versions in the full ISO repo), and the same
// element/definition recurs across versions nearly unchanged. Indexing every
// version was both slow to build and a wall of duplicates to fold.
//
// So we index ONLY the latest version of each message family (≈710k nodes —
// ~5× smaller), one record per element carrying a single lowercased "haystack"
// of its searchable text. A query pre-filters on the haystack, then attributes
// the few hits to specific fields. The version chips/clusters are computed
// lazily per hit by resolving that element's path across the family's versions:
//   message family (shortCode) + element (xmlPath) + field
//     └─ value cluster (identical text)
//          └─ version chips (the identifiers that hold that text)
// Tradeoff: a match that exists ONLY in an older version (the latest dropped or
// reworded it past matching) won't surface — current messages are what matter,
// and this keeps the index small enough to stay responsive.
//
// The index is built off the keystroke (time-sliced via `prewarmMessageIndex`)
// and cached per repo.

import { elementAtPath, rootPath } from "@/core/erepository/elementPath"
import type {
  ERepository,
  MessageDefinition,
  MessageElement,
} from "@/core/types/types"
import { makeSnippet } from "./snippet"
import {
  constraintText,
  FIELD_RANK,
  MIN_QUERY,
  type HitField,
  type MessageHit,
  type ValueCluster,
} from "./search"

/** One searchable element of a family's latest version. */
interface ElementRecord {
  shortCode: string
  area: string
  messageName: string
  xmlPath: string
  el: MessageElement
  /** Lowercased concatenation of every searchable field — the scan haystack. */
  hay: string
}

interface MessageIndex {
  records: ElementRecord[]
  /** All versions per family, ascending by identifier — for lazy clustering. */
  versionsByShort: Map<string, MessageDefinition[]>
}

/** One field of one element that matched the query (derived lazily on a hit). */
interface FieldMatch {
  field: HitField
  detail?: string
  value: string
}

// The type line shown/searched for an element, e.g. `Max35Text (Text)`.
function typeText(el: MessageElement): string {
  return el.baseType ? `${el.type} (${el.baseType})` : el.type
}

// Every searchable field value of an element, in display order. Shared by the
// index builder (concatenated into the haystack) and the per-hit attribution.
function fieldsOf(el: MessageElement): FieldMatch[] {
  const out: FieldMatch[] = []
  const add = (field: HitField, value: string, detail?: string) => {
    if (value) out.push({ field, value, detail })
  }
  add("name", el.name)
  add("xmlTag", el.xmlTag)
  add("definition", el.definition)
  add("type", typeText(el))
  if (el.pattern) add("pattern", el.pattern)
  if (el.examples.length > 0) add("example", el.examples.join(", "))
  for (const c of el.codes)
    add("code", `${c.codeName} — ${c.definition}`, c.codeName)
  for (const c of el.constraints) add("constraint", constraintText(c), c.name)
  return out
}

/** Reconstruct one field's value for an element in another version (clustering). */
function fieldValue(
  el: MessageElement,
  field: HitField,
  detail?: string
): string | null {
  switch (field) {
    case "name":
      return el.name || null
    case "xmlTag":
      return el.xmlTag || null
    case "definition":
      return el.definition || null
    case "type":
      return typeText(el) || null
    case "pattern":
      return el.pattern
    case "example":
      return el.examples.length > 0 ? el.examples.join(", ") : null
    case "code": {
      const c = el.codes.find((c) => c.codeName === detail)
      return c ? `${c.codeName} — ${c.definition}` : null
    }
    case "constraint": {
      const c = el.constraints.find((c) => c.name === detail)
      return c ? constraintText(c) : null
    }
    default:
      return null
  }
}

// --- Index build (sync for tests/small repos, async/time-sliced for the UI) ---

const indexByRepo = new WeakMap<ERepository, MessageIndex>()
const buildingByRepo = new WeakMap<ERepository, Promise<MessageIndex>>()

/** Families walked between yields when building the index in the background. */
const YIELD_EVERY = 30

interface Family {
  shortCode: string
  area: string
  /** Ascending by identifier; the last entry is the latest version. */
  versions: MessageDefinition[]
}

/** Group every message into its `shortCode` family, versions ascending. */
function familiesOf(repo: ERepository): Family[] {
  const map = new Map<string, Family>()
  for (const area of repo.businessAreas) {
    for (const m of area.messages) {
      let f = map.get(m.shortCode)
      if (!f) {
        f = { shortCode: m.shortCode, area: area.name, versions: [] }
        map.set(m.shortCode, f)
      }
      f.versions.push(m)
    }
  }
  for (const f of map.values())
    f.versions.sort((a, b) => a.identifier.localeCompare(b.identifier))
  return [...map.values()]
}

/** Append one record per element of `family`'s latest version. */
function indexFamily(family: Family, out: ElementRecord[]): void {
  const latest = family.versions[family.versions.length - 1]
  const walk = (el: MessageElement, path: string) => {
    const hay = fieldsOf(el)
      .map((f) => f.value)
      .join("   ")
      .toLowerCase()
    out.push({
      shortCode: family.shortCode,
      area: family.area,
      messageName: latest.name,
      xmlPath: path,
      el,
      hay,
    })
    for (const child of el.elements) walk(child, `${path}/${child.xmlTag}`)
  }
  walk(latest.rootElement, rootPath(latest.rootElement))
}

function buildIndexSync(repo: ERepository): MessageIndex {
  const records: ElementRecord[] = []
  const versionsByShort = new Map<string, MessageDefinition[]>()
  for (const family of familiesOf(repo)) {
    versionsByShort.set(family.shortCode, family.versions)
    indexFamily(family, records)
  }
  return { records, versionsByShort }
}

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

async function buildIndexAsync(repo: ERepository): Promise<MessageIndex> {
  const records: ElementRecord[] = []
  const versionsByShort = new Map<string, MessageDefinition[]>()
  let since = 0
  for (const family of familiesOf(repo)) {
    versionsByShort.set(family.shortCode, family.versions)
    indexFamily(family, records)
    if (++since >= YIELD_EVERY) {
      since = 0
      await nextTick() // keep the main thread responsive during the build
    }
  }
  return { records, versionsByShort }
}

function getIndex(repo: ERepository): MessageIndex {
  let index = indexByRepo.get(repo)
  if (!index) {
    index = buildIndexSync(repo)
    indexByRepo.set(repo, index)
  }
  return index
}

/** Whether the message index for `repo` is already built (cheap, synchronous). */
export function isMessageIndexReady(repo: ERepository): boolean {
  return indexByRepo.has(repo)
}

// Incremental scan cache. Forward typing only narrows the match set
// (matches of "amount" ⊆ matches of "amo"), so when the new query extends the
// last one we re-scan just the previous matches instead of all ~700k records —
// making each subsequent keystroke far cheaper than the first.
let scanCache: {
  repo: ERepository
  q: string
  matched: ElementRecord[]
} | null = null

/**
 * Build and cache the message index in the background, yielding to the event
 * loop so the UI never freezes. Resolves once the index is ready (immediately if
 * it already is); concurrent callers share one build.
 */
export async function prewarmMessageIndex(repo: ERepository): Promise<void> {
  if (indexByRepo.has(repo)) return
  let building = buildingByRepo.get(repo)
  if (!building) {
    building = buildIndexAsync(repo).then((index) => {
      indexByRepo.set(repo, index)
      buildingByRepo.delete(repo)
      return index
    })
    buildingByRepo.set(repo, building)
  }
  await building
}

// --- Search over the built index ---

/** Normalized text, the cluster key — whitespace-collapsed, case-folded. */
function clusterKey(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase()
}

const short = (identifier: string): string =>
  identifier.split(".").pop() ?? identifier

/** Descending identifier order — newest version first. */
const byIdentifierDesc = (a: string, b: string) => b.localeCompare(a)

/**
 * Group a matched field's value across a family's versions into clusters of
 * identical text. `versions` is ascending, so the last write per cluster is its
 * newest representative (used for the snippet).
 */
function clustersAcrossVersions(
  versions: MessageDefinition[],
  xmlPath: string,
  field: HitField,
  detail: string | undefined,
  q: string
): ValueCluster[] {
  const map = new Map<string, { ids: string[]; rep: string }>()
  for (const v of versions) {
    const el = elementAtPath(v.rootElement, xmlPath)
    if (!el) continue
    const value = fieldValue(el, field, detail)
    if (!value || !value.toLowerCase().includes(q)) continue
    const ck = clusterKey(value)
    const entry = map.get(ck)
    if (entry) {
      entry.ids.push(v.identifier)
      entry.rep = value // ascending walk → newest value wins
    } else {
      map.set(ck, { ids: [v.identifier], rep: value })
    }
  }

  const clusters: ValueCluster[] = [...map.values()].map((entry) => ({
    snippet: makeSnippet(entry.rep, q),
    versions: entry.ids
      .slice()
      .sort(byIdentifierDesc)
      .map((identifier) => ({ identifier, short: short(identifier) })),
  }))
  // Newest-cluster first (by its leading, newest, version).
  clusters.sort((a, b) =>
    byIdentifierDesc(a.versions[0].identifier, b.versions[0].identifier)
  )
  return clusters
}

/**
 * Search the latest version of every message family for `query`, returning
 * deduped hits with per-value version clusters. Returns `[]` for queries shorter
 * than `MIN_QUERY`. Ranked by field (structural before prose), then a
 * prefix-match boost, then message family and path; capped at `limit`.
 *
 * Builds the index synchronously on first use if it isn't warm — call
 * `prewarmMessageIndex` first (and gate on `isMessageIndexReady`) to keep that
 * cost off the keystroke for large repositories.
 */
export function searchMessages(
  repo: ERepository,
  query: string,
  limit = 100
): MessageHit[] {
  const q = query.trim().toLowerCase()
  if (q.length < MIN_QUERY) return []

  const index = getIndex(repo)

  // Phase 1 — find & rank matches cheaply (no cluster building yet). Building
  // version clusters resolves a path across every family version, so doing it
  // for all (often tens of thousands of) matches before capping was the cost.
  // Re-scan only the previous query's matches when this one extends it.
  const source =
    scanCache && scanCache.repo === repo && q.startsWith(scanCache.q)
      ? scanCache.matched
      : index.records

  const matched: ElementRecord[] = []
  const candidates: {
    record: ElementRecord
    field: HitField
    detail?: string
    /** Precomputed sort score (lower first): field rank, name-prefix boost. */
    score: number
  }[] = []
  for (const r of source) {
    if (!r.hay.includes(q)) continue // cheap pre-filter on the haystack
    matched.push(r)
    // Name-prefix boost computed once per record, not per comparison.
    const namePrefix = r.el.name.toLowerCase().startsWith(q) ? 0 : 1
    for (const m of fieldsOf(r.el)) {
      if (m.value.toLowerCase().includes(q))
        candidates.push({
          record: r,
          field: m.field,
          detail: m.detail,
          score: FIELD_RANK[m.field] * 2 + namePrefix,
        })
    }
  }
  scanCache = { repo, q, matched }

  // Cheap comparator (plain string compare beats locale-aware here).
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
  candidates.sort(
    (a, b) =>
      a.score - b.score ||
      cmp(a.record.shortCode, b.record.shortCode) ||
      cmp(a.record.xmlPath, b.record.xmlPath)
  )

  // Phase 2 — build version clusters only for the results we'll actually show.
  const hits: MessageHit[] = []
  for (const c of candidates) {
    if (hits.length >= limit) break
    const { record: r } = c
    const versions = index.versionsByShort.get(r.shortCode)
    if (!versions) continue
    const clusters = clustersAcrossVersions(
      versions,
      r.xmlPath,
      c.field,
      c.detail,
      q
    )
    if (clusters.length === 0) continue
    hits.push({
      shortCode: r.shortCode,
      messageName: r.messageName,
      area: r.area,
      xmlPath: r.xmlPath,
      elementName: r.el.name,
      field: c.field,
      detail: c.detail,
      clusters,
      latestIdentifier: versions[versions.length - 1].identifier,
    })
  }

  return hits
}
