// Diff an effective MIG against the ISO message definition.
//
// For every path the effective overlay touches, compare each field to the ISO
// element's baseline and classify the change. A MIG is meant to *tighten* the
// message; `loosened`/`removed` are the high-signal cases (a MIG looser than the
// standard). Output is in message **schema (document) order**, so the report
// reads like the message. Pure — feeds the Markdown renderer (and could feed CSV).

import { getMigKey } from "./migKey"
import { resolveConstraints } from "./constraints"
import type { EffectiveMig } from "./effectiveMig"
import type {
  Constraint,
  ElementOverride,
  MessageDefinition,
  MessageElement,
} from "@/core/types/types"

export type ChangeKind = "tightened" | "loosened" | "removed" | "added" | "changed"

export type FieldChange = {
  /** Display label, e.g. "Max length", or an annotation name. */
  label: string
  kind: ChangeKind
  /** ISO baseline value, rendered for display. */
  baseline: string
  /** Effective MIG value, rendered for display. */
  value: string
}

export type ConstraintInfo = {
  name: string
  definition: string
  expression?: string
  annotations: { name: string; value: string }[]
  /** `added` = a MIG-added rule; `standard` = an overlaid ISO/inherited rule. */
  source: "added" | "standard"
  /** The rule is switched off by the MIG. */
  disabled?: boolean
}

export type ElementDiff = {
  path: string
  name: string
  /** Effective `maxOccurs: 0` — the element is removed from the message. */
  excluded: boolean
  /** The path has an override but isn't in this message version (stale). */
  orphan: boolean
  changes: FieldChange[]
  constraints: ConstraintInfo[]
}

export type MigDiff = {
  message: { name: string; identifier: string }
  mig: { name: string; version: string; description?: string; parents: string[] }
  elements: ElementDiff[]
  /** Count of `loosened` + `removed` field changes — drives the warning summary. */
  loosenings: number
  /** A parent MIG that wasn't loaded, so its inherited constraints are absent. */
  missingParent?: string
}

type NumericKey =
  | "minOccurs"
  | "maxOccurs"
  | "minInclusive"
  | "maxInclusive"
  | "totalDigits"
  | "fractionDigits"
  | "minLength"
  | "maxLength"

// Each numeric facet and the direction that *tightens* it.
const NUMERIC_FIELDS: { key: NumericKey; label: string; dir: "min" | "max" }[] = [
  { key: "minOccurs", label: "Min occurs", dir: "min" },
  { key: "maxOccurs", label: "Max occurs", dir: "max" },
  { key: "minInclusive", label: "Min inclusive", dir: "min" },
  { key: "maxInclusive", label: "Max inclusive", dir: "max" },
  { key: "totalDigits", label: "Total digits", dir: "max" },
  { key: "fractionDigits", label: "Fraction digits", dir: "max" },
  { key: "minLength", label: "Min length", dir: "min" },
  { key: "maxLength", label: "Max length", dir: "max" },
]

function numericBaseline(el: MessageElement, key: NumericKey): number | null {
  if (key === "minLength") return el.minLength ?? el.length
  if (key === "maxLength") return el.maxLength ?? el.length
  return el[key]
}

function classifyNumeric(
  baseline: number | null,
  value: number | null,
  dir: "min" | "max",
): ChangeKind | null {
  if (value === baseline) return null
  if (value === null) return baseline === null ? null : "removed"
  if (baseline === null) return "tightened" // adding a bound restricts
  if (dir === "min") return value > baseline ? "tightened" : "loosened"
  return value < baseline ? "tightened" : "loosened"
}

const fmtNum = (key: NumericKey, v: number | null) =>
  v === null ? (key === "maxOccurs" ? "unbounded" : "none") : String(v)

const sameSet = (a: string[], b: string[]) => {
  const sb = new Set(b)
  return a.length === b.length && new Set(a).size === sb.size && a.every((x) => sb.has(x))
}
const subsetOf = (a: string[], b: string[]) => {
  const sb = new Set(b)
  return a.every((x) => sb.has(x))
}
const summarize = (xs: string[]) =>
  xs.length === 0 ? "none" : xs.length > 8 ? `${xs.slice(0, 8).join(", ")}, … (${xs.length})` : xs.join(", ")

function toConstraintInfo(
  c: Constraint,
  source: "added" | "standard",
  disabled: boolean,
): ConstraintInfo {
  return {
    name: c.name,
    definition: c.definition,
    ...(c.expression ? { expression: c.expression } : {}),
    annotations: Object.entries(c.annotations ?? {})
      .filter(([, v]) => v != null && v !== "")
      .map(([name, v]) => ({ name, value: v as string })),
    source,
    ...(disabled ? { disabled: true } : {}),
  }
}

/**
 * The constraints to report for an overridden element: every MIG-added rule, plus
 * any standard/inherited rule the MIG overlays (changed expression/definition, or
 * disabled). Each carries its effective fields and disabled state.
 */
function constraintInfos(el: MessageElement, ov: ElementOverride): ConstraintInfo[] {
  const overlaid = new Set(Object.keys(ov.constraintOverrides ?? {}))
  return resolveConstraints(el, ov)
    .filter((r) => r.source === "additional" || overlaid.has(r.constraint.name))
    .map((r) => toConstraintInfo(r.constraint, r.source === "additional" ? "added" : "standard", r.disabled))
}

/** Field-level changes for one overridden element vs its ISO baseline. */
function diffElement(el: MessageElement, path: string, ov: ElementOverride): ElementDiff {
  if ("maxOccurs" in ov && ov.maxOccurs === 0) {
    return { path, name: el.name, excluded: true, orphan: false, changes: [], constraints: [] }
  }

  const changes: FieldChange[] = []
  const push = (label: string, kind: ChangeKind | null, baseline: string, value: string) => {
    if (kind) changes.push({ label, kind, baseline, value })
  }

  for (const { key, label, dir } of NUMERIC_FIELDS) {
    if (!(key in ov)) continue
    const baseline = numericBaseline(el, key)
    const value = ov[key] ?? null
    push(label, classifyNumeric(baseline, value, dir), fmtNum(key, baseline), fmtNum(key, value))
  }

  if ("definition" in ov) {
    const value = ov.definition ?? ""
    push(
      "Definition",
      value === el.definition ? null : "changed",
      el.definition || "—",
      value || "—",
    )
  }

  if ("pattern" in ov) {
    const value = ov.pattern ?? null
    const kind =
      value === el.pattern ? null : value === null ? "removed" : el.pattern === null ? "added" : "changed"
    push("Pattern", kind, el.pattern ?? "none", value ?? "none")
  }

  if ("allowedValues" in ov) {
    const baseline = el.codes.map((c) => c.codeName)
    const value = ov.allowedValues ?? null
    const kind: ChangeKind | null =
      value === null
        ? baseline.length
          ? "removed"
          : null
        : sameSet(value, baseline)
          ? null
          : baseline.length === 0 || subsetOf(value, baseline)
            ? "tightened"
            : "loosened"
    push("Allowed values", kind, summarize(baseline), value === null ? "any" : summarize(value))
  }

  if ("examples" in ov) {
    const value = ov.examples ?? []
    push("Examples", sameSet(value, el.examples) ? null : "changed", summarize(el.examples), summarize(value))
  }

  for (const [name, v] of Object.entries(ov.annotations ?? {})) {
    if (v != null && v !== "") changes.push({ label: name, kind: "added", baseline: "—", value: v })
  }

  return {
    path,
    name: el.name,
    excluded: false,
    orphan: false,
    changes,
    constraints: constraintInfos(el, ov),
  }
}

/** Best-effort diff for an override whose path isn't in this message version. */
function diffOrphan(path: string, ov: ElementOverride): ElementDiff {
  const name = path.slice(path.lastIndexOf("/") + 1)
  const changes: FieldChange[] = []
  for (const { key, label } of NUMERIC_FIELDS) {
    if (key in ov) changes.push({ label, kind: "changed", baseline: "—", value: fmtNum(key, ov[key] ?? null) })
  }
  if ("pattern" in ov) changes.push({ label: "Pattern", kind: "changed", baseline: "—", value: ov.pattern ?? "none" })
  if ("definition" in ov)
    changes.push({ label: "Definition", kind: "changed", baseline: "—", value: ov.definition || "—" })
  for (const [n, v] of Object.entries(ov.annotations ?? {})) {
    if (v != null && v !== "") changes.push({ label: n, kind: "added", baseline: "—", value: v })
  }
  return {
    path,
    name,
    excluded: "maxOccurs" in ov && ov.maxOccurs === 0,
    orphan: true,
    changes,
    // No ISO element to overlay onto for an orphan path — only added rules.
    constraints: (ov.additionalConstraints ?? []).map((c) =>
      toConstraintInfo(c, "added", ov.constraintOverrides?.[c.name]?.disabled ?? false),
    ),
  }
}

/** Diff an effective MIG against its ISO message, in schema order. */
export function diffMig(effective: EffectiveMig, message: MessageDefinition): MigDiff {
  const overrides = effective.mig.elementOverrides
  const elements: ElementDiff[] = []
  const seen = new Set<string>()

  const walk = (el: MessageElement, path: string) => {
    const ov = overrides[path]
    if (ov) {
      seen.add(path)
      elements.push(diffElement(el, path, ov))
    }
    for (const child of el.elements) walk(child, `${path}/${child.xmlTag}`)
  }
  walk(message.rootElement, message.rootElement.xmlTag)

  for (const [path, ov] of Object.entries(overrides)) {
    if (!seen.has(path)) elements.push(diffOrphan(path, ov))
  }

  const loosenings = elements.reduce(
    (n, e) => n + e.changes.filter((c) => c.kind === "loosened" || c.kind === "removed").length,
    0,
  )

  return {
    message: { name: message.name, identifier: message.identifier },
    mig: {
      name: effective.mig.name,
      version: effective.mig.version,
      ...(effective.mig.description ? { description: effective.mig.description } : {}),
      parents: effective.chain.slice(0, -1).map(getMigKey),
    },
    elements,
    loosenings,
    ...(effective.missingParent ? { missingParent: effective.missingParent } : {}),
  }
}
