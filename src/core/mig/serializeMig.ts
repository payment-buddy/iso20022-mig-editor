// Canonical MIG → YAML serialization (deterministic, diff-stable form).
//
// The contract (not optional — it's what keeps diffs stable):
//   - `formatVersion: 1` first, then keys in MIG_PROPERTY_ORDER.
//   - `elementOverrides` ordered by message **schema (document) order**, parents
//     before children, via a `pathOrder` index; unknown paths sort last.
//   - Each override / constraint orders its keys per the property-order constants.
//   - `additionalConstraints` is a name-keyed map (sorted by name); each entry's
//     `annotations` map is ordered by its declared-name list then alphabetically.
//   - Absent keys omitted and empty arrays/maps dropped, but explicit `null` is
//     **preserved** (tri-state "remove the constraint").
//   - `lineWidth: 0`, multi-line strings as block literals, no anchors/aliases,
//     2-space indent, trailing newline.

import { stringify } from "yaml"
import { rootPath } from "@/core/erepository/elementPath"
import {
  ADDITIONAL_CONSTRAINT_PROPERTY_ORDER,
  CONSTRAINT_OVERRIDE_PROPERTY_ORDER,
  ELEMENT_OVERRIDE_PROPERTY_ORDER,
  MIG_PROPERTY_ORDER,
} from "@/core/mig/migConstants"
import type {
  AdditionalConstraint,
  ConstraintOverride,
  ElementOverride,
  MessageElement,
  MessageImplementationGuide,
} from "@/core/types/types"

// The lib's defaults already render multi-line strings as block literals (`|`)
// while keeping single-line strings plain/quoted. We only
// override line-wrapping, anchors, and indent.
const STRINGIFY_OPTIONS = {
  lineWidth: 0,
  aliasDuplicateObjects: false,
  indent: 2,
} as const

/** Sentinel ordinal for paths absent from the schema index (sorted to the end). */
const UNKNOWN = Number.MAX_SAFE_INTEGER

/**
 * Build a `xmlPath → document-ordinal` index by walking the message tree in
 * order. Paths match the `elementOverrides` keys (absolute: `/${root.xmlTag}`,
 * then `${path}/${child.xmlTag}`). Pass to `serializeMig` for schema-ordered output.
 */
export function buildPathOrder(root: MessageElement): Map<string, number> {
  const order = new Map<string, number>()
  let i = 0
  const walk = (el: MessageElement, path: string) => {
    order.set(path, i++)
    for (const child of el.elements) walk(child, `${path}/${child.xmlTag}`)
  }
  walk(root, rootPath(root))
  return order
}

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Order an annotations map by declared names first, then alphabetically. Null = omit. */
function canonicalAnnotations(
  map: Record<string, string | null>,
  declared: string[] | undefined
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
function canonicalAdditionalConstraint(
  c: AdditionalConstraint,
  declared: string[] | undefined
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of ADDITIONAL_CONSTRAINT_PROPERTY_ORDER) {
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

/** An `additionalConstraints` map, keyed by name (sorted); empty map dropped. */
function canonicalAdditionalConstraints(
  map: Record<string, AdditionalConstraint>,
  declared: string[] | undefined
): Record<string, unknown> | null {
  const out: Record<string, unknown> = {}
  for (const name of Object.keys(map).sort(byString)) {
    out[name] = canonicalAdditionalConstraint(map[name], declared)
  }
  return Object.keys(out).length > 0 ? out : null
}

/** One constraint override with keys in canonical order; preserves `null`, drops empties. */
function canonicalConstraintOverride(
  co: ConstraintOverride,
  declared: string[] | undefined
): Record<string, unknown> | null {
  const out: Record<string, unknown> = {}
  for (const key of CONSTRAINT_OVERRIDE_PROPERTY_ORDER) {
    if (!(key in co)) continue
    if (key === "annotations") {
      const a = canonicalAnnotations(co.annotations ?? {}, declared)
      if (a) out.annotations = a
      continue
    }
    out[key] = co[key] // value or explicit null (tri-state preserved)
  }
  return Object.keys(out).length > 0 ? out : null
}

/** A `constraintOverrides` map, keyed by name (sorted); empty entries/map dropped. */
function canonicalConstraintOverrides(
  map: Record<string, ConstraintOverride>,
  declared: string[] | undefined
): Record<string, unknown> | null {
  const out: Record<string, unknown> = {}
  for (const name of Object.keys(map).sort(byString)) {
    const co = canonicalConstraintOverride(map[name], declared)
    if (co) out[name] = co
  }
  return Object.keys(out).length > 0 ? out : null
}

/** One element override with keys in canonical order; preserves `null`, drops empties. */
function canonicalOverride(
  override: ElementOverride,
  mig: MessageImplementationGuide
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of ELEMENT_OVERRIDE_PROPERTY_ORDER) {
    if (!(key in override)) continue
    if (key === "annotations") {
      const a = canonicalAnnotations(
        override.annotations ?? {},
        mig.elementAnnotationNames
      )
      if (a) out.annotations = a
      continue
    }
    if (key === "additionalConstraints") {
      const ac = canonicalAdditionalConstraints(
        override.additionalConstraints ?? {},
        mig.constraintAnnotationNames
      )
      if (ac) out.additionalConstraints = ac
      continue
    }
    if (key === "constraintOverrides") {
      const co = canonicalConstraintOverrides(
        override.constraintOverrides ?? {},
        mig.constraintAnnotationNames
      )
      if (co) out.constraintOverrides = co
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
  pathOrder: Map<string, number> | undefined
): Record<string, unknown> {
  const ordinal = (p: string) => pathOrder?.get(p) ?? UNKNOWN
  const out: Record<string, unknown> = {}
  for (const [path, override] of Object.entries(mig.elementOverrides).sort(
    ([a], [b]) => ordinal(a) - ordinal(b) || byString(a, b)
  )) {
    const co = canonicalOverride(override, mig)
    if (Object.keys(co).length > 0) out[path] = co
  }
  return out
}

/** Build the canonical, ordered plain object for one MIG (`formatVersion` first). */
function canonicalMig(
  mig: MessageImplementationGuide,
  pathOrder: Map<string, number> | undefined
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
 * Serialize one MIG to canonical YAML. Pass `pathOrder`
 * (from `buildPathOrder`) to order overrides by message schema order; without
 * it, overrides fall back to alphabetical path order.
 */
export function serializeMig(
  mig: MessageImplementationGuide,
  pathOrder?: Map<string, number>
): string {
  return withTrailingNewline(
    stringify(canonicalMig(mig, pathOrder), STRINGIFY_OPTIONS)
  )
}

/** Serialize many MIGs as a single YAML array (backup/bulk form). */
export function serializeMigs(migs: MessageImplementationGuide[]): string {
  return withTrailingNewline(
    stringify(
      migs.map((m) => canonicalMig(m, undefined)),
      STRINGIFY_OPTIONS
    )
  )
}
