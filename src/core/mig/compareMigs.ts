// Semantic diff of two MIGs (FUNCTIONALITY §5.8 / Phase 4 Compare). Unlike
// `migDiff.ts` (which diffs an *effective* MIG against the ISO baseline for the
// Markdown export), this compares the **declared** `elementOverrides` of two MIGs
// to each other — answering "how do these two documents differ". Pure; the
// Compare screen renders the result side-by-side, showing only differing
// elements.
//
// Override fields are tri-state (CLAUDE.md / MIG_FORMAT.md): absent = inherit,
// `null` = clear the inherited constraint, value = set. The comparison preserves
// that distinction via key-presence — a field absent in one MIG (`a`/`b` = null
// in a FieldChange) reads as "inherits", a stored `null` renders as "cleared".

import type {
  Constraint,
  ElementOverride,
  MessageImplementationGuide,
} from "@/core/types/types"

export type FieldChangeKind = "added" | "removed" | "changed"

export type FieldChange = {
  /** Display label, e.g. "Max length", an annotation name, or a constraint name. */
  label: string
  kind: FieldChangeKind
  /** Rendered value in MIG A, or `null` when A doesn't set this field (inherits). */
  a: string | null
  /** Rendered value in MIG B, or `null` when B doesn't set this field (inherits). */
  b: string | null
}

export type PathChangeKind = "added" | "removed" | "changed"

export type PathDiff = {
  path: string
  /** Leaf element name (last path segment / xmlTag). */
  name: string
  /** `added` = overridden only in B, `removed` = only in A, `changed` = in both but differs. */
  kind: PathChangeKind
  fields: FieldChange[]
}

export type MigComparison = {
  a: { name: string; version: string }
  b: { name: string; version: string }
  /** The two MIGs target the same message — schema-order alignment is meaningful. */
  sameMessage: boolean
  /** Only the paths that differ, in schema order when a path-order map is given. */
  paths: PathDiff[]
}

type MigInput = Pick<
  MessageImplementationGuide,
  "name" | "version" | "messageIdentifier" | "elementOverrides"
>

// Scalar override fields and their display labels, in serialization order.
const SCALAR_FIELDS: { key: keyof ElementOverride; label: string }[] = [
  { key: "definition", label: "Definition" },
  { key: "minOccurs", label: "Min occurs" },
  { key: "maxOccurs", label: "Max occurs" },
  { key: "minInclusive", label: "Min inclusive" },
  { key: "maxInclusive", label: "Max inclusive" },
  { key: "totalDigits", label: "Total digits" },
  { key: "fractionDigits", label: "Fraction digits" },
  { key: "minLength", label: "Min length" },
  { key: "maxLength", label: "Max length" },
  { key: "pattern", label: "Pattern" },
]

const sameSet = (a: string[], b: string[]) => {
  const sb = new Set(b)
  return a.length === b.length && new Set(a).size === sb.size && a.every((x) => sb.has(x))
}

const summarize = (xs: string[]) =>
  xs.length === 0
    ? "none"
    : xs.length > 8
      ? `${xs.slice(0, 8).join(", ")}, … (${xs.length})`
      : xs.join(", ")

/** Render a declared scalar value for display. `null` (a cleared constraint) is explicit. */
function renderScalar(key: keyof ElementOverride, v: number | string | null): string {
  if (v === null) return "cleared"
  if (key === "definition") return v === "" ? "(empty)" : String(v)
  return String(v)
}

function renderConstraint(c: Constraint): string {
  const parts = [c.definition]
  if (c.expression) parts.push(`[${c.expression}]`)
  return parts.filter(Boolean).join(" ") || c.name
}

function sameConstraint(a: Constraint, b: Constraint): boolean {
  if (a.definition !== b.definition || (a.expression ?? "") !== (b.expression ?? "")) return false
  const aa = a.annotations ?? {}
  const ba = b.annotations ?? {}
  const keys = new Set([...Object.keys(aa), ...Object.keys(ba)])
  for (const k of keys) if ((aa[k] ?? null) !== (ba[k] ?? null)) return false
  return true
}

// Classify a present/absent pair. Callers pre-check value equality, so a
// both-present pair here is always a genuine "changed" (don't re-derive it from
// the rendered strings — two different values can render to the same summary).
function pair(
  label: string,
  inA: boolean,
  inB: boolean,
  a: string | null,
  b: string | null,
): FieldChange | null {
  if (!inA && !inB) return null
  if (inA && inB) return { label, kind: "changed", a, b }
  return inA ? { label, kind: "removed", a, b: null } : { label, kind: "added", a: null, b }
}

/** Field-level changes between two declared overrides (either may be `{}`). */
function diffOverride(ovA: ElementOverride, ovB: ElementOverride): FieldChange[] {
  const changes: FieldChange[] = []
  const push = (c: FieldChange | null) => {
    if (c) changes.push(c)
  }

  for (const { key, label } of SCALAR_FIELDS) {
    const inA = key in ovA
    const inB = key in ovB
    // `?? null` only normalizes a missing key; presence is decided by `in` above,
    // so a stored `null` is preserved (tri-state), not collapsed into "inherit".
    const rawA = (ovA[key] ?? null) as number | string | null
    const rawB = (ovB[key] ?? null) as number | string | null
    if (inA && inB && rawA === rawB) continue
    push(
      pair(
        label,
        inA,
        inB,
        inA ? renderScalar(key, rawA) : null,
        inB ? renderScalar(key, rawB) : null,
      ),
    )
  }

  for (const [key, label] of [
    ["allowedValues", "Allowed values"],
    ["examples", "Examples"],
  ] as const) {
    const inA = key in ovA
    const inB = key in ovB
    const valA = ovA[key] ?? []
    const valB = ovB[key] ?? []
    if (inA && inB && sameSet(valA, valB)) continue
    push(pair(label, inA, inB, inA ? summarize(valA) : null, inB ? summarize(valB) : null))
  }

  const annA = ovA.annotations ?? {}
  const annB = ovB.annotations ?? {}
  for (const name of new Set([...Object.keys(annA), ...Object.keys(annB)])) {
    const inA = name in annA
    const inB = name in annB
    if (inA && inB && annA[name] === annB[name]) continue
    push(pair(name, inA, inB, inA ? annA[name] : null, inB ? annB[name] : null))
  }

  const consA = ovA.additionalConstraints ?? []
  const consB = ovB.additionalConstraints ?? []
  for (const name of new Set([...consA, ...consB].map((c) => c.name))) {
    const ca = consA.find((c) => c.name === name)
    const cb = consB.find((c) => c.name === name)
    if (ca && cb && sameConstraint(ca, cb)) continue
    push(
      pair(
        `Constraint “${name}”`,
        !!ca,
        !!cb,
        ca ? renderConstraint(ca) : null,
        cb ? renderConstraint(cb) : null,
      ),
    )
  }

  return changes
}

/**
 * Compare two MIGs' declared overrides. Returns only paths that differ; within
 * each, only the fields that differ. When `order` (path → schema index, from
 * `buildPathOrder`) is supplied, paths sort in message schema order with unknown
 * paths appended alphabetically.
 */
export function compareMigs(
  a: MigInput,
  b: MigInput,
  order?: Map<string, number>,
): MigComparison {
  const overA = a.elementOverrides
  const overB = b.elementOverrides
  const paths: PathDiff[] = []

  for (const path of new Set([...Object.keys(overA), ...Object.keys(overB)])) {
    const inA = path in overA
    const inB = path in overB
    const fields = diffOverride(overA[path] ?? {}, overB[path] ?? {})
    if (fields.length === 0) continue // both present and identical
    paths.push({
      path,
      name: path.slice(path.lastIndexOf("/") + 1),
      kind: inA && inB ? "changed" : inA ? "removed" : "added",
      fields,
    })
  }

  const rank = (p: string) => order?.get(p) ?? Number.POSITIVE_INFINITY
  paths.sort((x, y) => rank(x.path) - rank(y.path) || x.path.localeCompare(y.path))

  return {
    a: { name: a.name, version: a.version },
    b: { name: b.name, version: b.version },
    sameMessage: a.messageIdentifier === b.messageIdentifier,
    paths,
  }
}
