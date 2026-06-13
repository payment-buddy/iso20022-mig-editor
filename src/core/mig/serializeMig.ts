// Canonical MIG → YAML serialization, conforming to MIG_FORMAT.md.
//
// The contract (not optional — it's what keeps diffs stable):
//   - `formatVersion: 1` first, then keys in MIG_PROPERTY_ORDER (§3).
//   - `elementOverrides` ordered by message **schema (document) order**, parents
//     before children, via a `pathOrder` index; unknown paths sort last.
//   - Each override / constraint orders its keys per the property-order constants.
//   - `additionalConstraints` sorted by name; each `annotations` map ordered by
//     its declared-name list then alphabetically.
//   - Absent keys omitted and empty arrays/maps dropped, but explicit `null` is
//     **preserved** (tri-state "remove the constraint" — §5).
//   - `lineWidth: 0`, multi-line strings as block literals, no anchors/aliases,
//     2-space indent, trailing newline.

import { stringify } from "yaml"
import {
  CONSTRAINT_PROPERTY_ORDER,
  ELEMENT_OVERRIDE_PROPERTY_ORDER,
  MIG_PROPERTY_ORDER,
} from "@/core/mig/migConstants"
import type {
  Constraint,
  ElementOverride,
  MessageElement,
  MessageImplementationGuide,
} from "@/core/types/types"

const STRINGIFY_OPTIONS = {
  lineWidth: 0,
  defaultStringType: "BLOCK_LITERAL",
  defaultKeyType: "PLAIN",
  aliasDuplicateObjects: false,
  indent: 2,
} as const

/** Sentinel ordinal for paths absent from the schema index (sorted to the end). */
const UNKNOWN = Number.MAX_SAFE_INTEGER

/**
 * Build a `xmlPath → document-ordinal` index by walking the message tree in
 * order. Paths match the `elementOverrides` keys (root `xmlTag`, then
 * `${path}/${child.xmlTag}`). Pass to `serializeMig` for schema-ordered output.
 */
export function buildPathOrder(root: MessageElement): Map<string, number> {
  const order = new Map<string, number>()
  let i = 0
  const walk = (el: MessageElement, path: string) => {
    order.set(path, i++)
    for (const child of el.elements) walk(child, `${path}/${child.xmlTag}`)
  }
  walk(root, root.xmlTag)
  return order
}

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Order an annotations map by declared names first, then alphabetically. Null = omit. */
function canonicalAnnotations(
  map: Record<string, string | null>,
  declared: string[] | undefined,
): Record<string, string | null> | null {
  const keys = Object.keys(map)
  if (keys.length === 0) return null
  const names = declared ?? []
  const rank = (k: string) => {
    const i = names.indexOf(k)
    return i === -1 ? UNKNOWN : i
  }
  keys.sort((a, b) => rank(a) - rank(b) || byString(a, b))
  const out: Record<string, string | null> = {}
  for (const k of keys) out[k] = map[k]
  return out
}

/** One additional constraint with keys in canonical order (empty annotations dropped). */
function canonicalConstraint(c: Constraint, declared: string[] | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of CONSTRAINT_PROPERTY_ORDER) {
    if (!(key in c)) continue
    if (key === "annotations") {
      const a = canonicalAnnotations(c.annotations ?? {}, declared)
      if (a) out.annotations = a
      continue
    }
    const v = c[key]
    if (v !== undefined) out[key] = v
  }
  return out
}

/** One element override with keys in canonical order; preserves `null`, drops empties. */
function canonicalOverride(
  override: ElementOverride,
  mig: MessageImplementationGuide,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of ELEMENT_OVERRIDE_PROPERTY_ORDER) {
    if (!(key in override)) continue
    if (key === "annotations") {
      const a = canonicalAnnotations(override.annotations ?? {}, mig.elementAnnotationNames)
      if (a) out.annotations = a
      continue
    }
    if (key === "additionalConstraints") {
      const list = override.additionalConstraints ?? []
      if (list.length > 0) {
        out.additionalConstraints = [...list]
          .sort((a, b) => byString(a.name, b.name))
          .map((c) => canonicalConstraint(c, mig.constraintAnnotationNames))
      }
      continue
    }
    const v = override[key]
    if (v === undefined) continue
    if (Array.isArray(v) && v.length === 0) continue // empty list → omit (use null to remove)
    out[key] = v // value or explicit null (tri-state preserved)
  }
  return out
}

/** Element overrides, schema-ordered by `pathOrder` (unknown paths last), empties dropped. */
function canonicalOverrides(
  mig: MessageImplementationGuide,
  pathOrder: Map<string, number> | undefined,
): Record<string, unknown> {
  const ordinal = (p: string) => pathOrder?.get(p) ?? UNKNOWN
  const out: Record<string, unknown> = {}
  for (const [path, override] of Object.entries(mig.elementOverrides).sort(
    ([a], [b]) => ordinal(a) - ordinal(b) || byString(a, b),
  )) {
    const co = canonicalOverride(override, mig)
    if (Object.keys(co).length > 0) out[path] = co
  }
  return out
}

/** Build the canonical, ordered plain object for one MIG (`formatVersion` first). */
function canonicalMig(
  mig: MessageImplementationGuide,
  pathOrder: Map<string, number> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = { formatVersion: 1 }
  for (const key of MIG_PROPERTY_ORDER) {
    if (key === "elementOverrides") {
      out.elementOverrides = canonicalOverrides(mig, pathOrder)
      continue
    }
    const v = mig[key]
    if (v === undefined) continue
    if (Array.isArray(v) && v.length === 0) continue
    out[key] = v
  }
  return out
}

const withTrailingNewline = (s: string) => s.replace(/\n*$/, "\n")

/**
 * Serialize one MIG to canonical YAML (MIG_FORMAT.md). Pass `pathOrder`
 * (from `buildPathOrder`) to order overrides by message schema order; without
 * it, overrides fall back to alphabetical path order.
 */
export function serializeMig(
  mig: MessageImplementationGuide,
  pathOrder?: Map<string, number>,
): string {
  return withTrailingNewline(stringify(canonicalMig(mig, pathOrder), STRINGIFY_OPTIONS))
}

/** Serialize many MIGs as a single YAML array (backup/bulk form). */
export function serializeMigs(migs: MessageImplementationGuide[]): string {
  return withTrailingNewline(
    stringify(
      migs.map((m) => canonicalMig(m, undefined)),
      STRINGIFY_OPTIONS,
    ),
  )
}
