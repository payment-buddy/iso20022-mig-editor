// Export a MIG as CSV (FUNCTIONALITY §10 — "Markdown + CSV", CSV opens in Excel).
// The whole ISO message tree is flattened in document order: one row per element
// (structure + ISO type), then one row per rule (ISO constraints — with any MIG
// expression/definition overlay or disable applied — the MIG's multiplicity/type
// overrides, and added constraints) with its provenance. A disabled rule is
// marked "(disabled)" in the Rule column. Pure.
//
// Layout — common columns describe the element and are blank on rule rows
// (`Path` is an indented multiline name tree, root skipped; `Annotations` holds
// the element's own annotations as multiline `key: value`):
//   Level | Choice | Name | XML tag | Path | Multiplicity | Type | Annotations
// rule columns are blank on the element row:
//   Source | Rule | Definition | Expression | <one column per constraint annotation>
//
// Source provenance: "ISO" (rule from the message definition) or a MIG name —
// this MIG's own name when it set the rule, or an ancestor's when inherited.
// Computed from the effective parent chain (ancestor→leaf, leaf = this MIG).

import { effectiveMig } from "./effectiveMig"
import { resolveConstraints } from "./constraints"
import { shortCodeForIdentifier } from "@/core/erepository/messageIdentifier"
import type {
  Constraint,
  ElementOverride,
  MessageDefinition,
  MessageElement,
  MessageImplementationGuide,
} from "@/core/types/types"

// Override keys that describe the data type (vs. occurs / definition / examples).
const TYPE_FACET_KEYS: (keyof ElementOverride)[] = [
  "minInclusive",
  "maxInclusive",
  "totalDigits",
  "fractionDigits",
  "minLength",
  "maxLength",
  "pattern",
  "allowedValues",
]

// Common (element) columns; "Annotations" holds the element's own annotations as
// multiline `key: value`. Rule columns describe one constraint/override.
const COMMON_COLUMNS = [
  "Level",
  "Choice",
  "Name",
  "XML tag",
  "Path",
  "Multiplicity",
  "Type",
  "Annotations",
]
const RULE_COLUMNS = ["Source", "Rule", "Definition", "Expression"]

type Facets = {
  codes: string[]
  pattern: string | null
  totalDigits: number | null
  fractionDigits: number | null
  length: number | null
  minLength: number | null
  maxLength: number | null
  minInclusive: number | null
  maxInclusive: number | null
}

function isoFacets(el: MessageElement): Facets {
  return {
    codes: el.codes.map((c) => c.codeName),
    pattern: el.pattern,
    totalDigits: el.totalDigits,
    fractionDigits: el.fractionDigits,
    length: el.length,
    minLength: el.minLength,
    maxLength: el.maxLength,
    minInclusive: el.minInclusive,
    maxInclusive: el.maxInclusive,
  }
}

/** Apply an override's type facets onto the ISO facets (key-presence; null clears). */
function withOverride(f: Facets, ov: ElementOverride): Facets {
  const g = { ...f }
  if ("allowedValues" in ov && ov.allowedValues != null) g.codes = ov.allowedValues
  if ("pattern" in ov) g.pattern = ov.pattern ?? null
  if ("totalDigits" in ov) g.totalDigits = ov.totalDigits ?? null
  if ("fractionDigits" in ov) g.fractionDigits = ov.fractionDigits ?? null
  if ("minLength" in ov) g.minLength = ov.minLength ?? null
  if ("maxLength" in ov) g.maxLength = ov.maxLength ?? null
  if ("minInclusive" in ov) g.minInclusive = ov.minInclusive ?? null
  if ("maxInclusive" in ov) g.maxInclusive = ov.maxInclusive ?? null
  return g
}

/** The bracketed facet, e.g. `1..35`, `EUR|USD`, `[A-Z]+`, `18.4`. */
function facetString(f: Facets): string | null {
  if (f.codes.length > 0) return f.codes.join("|")
  if (f.pattern) return f.pattern
  if (f.totalDigits != null || f.fractionDigits != null) return `${f.totalDigits ?? ""}.${f.fractionDigits ?? ""}`
  if (f.length != null && f.minLength == null && f.maxLength == null) return String(f.length)
  if (f.minLength != null || f.maxLength != null) return `${f.minLength ?? ""}..${f.maxLength ?? ""}`
  if (f.minInclusive != null || f.maxInclusive != null) return `${f.minInclusive ?? ""}..${f.maxInclusive ?? ""}`
  return null
}

/** ISO data type with simple constraints, e.g. `Text[1..35]`. Blank for complex elements. */
function typeString(el: MessageElement, facets: Facets): string {
  if (el.elements.length > 0) return "" // complex type — no simple data type
  const base = (el.baseType ?? el.type ?? "").replace(/^ISO/, "")
  const facet = facetString(facets)
  return facet ? `${base}[${facet}]` : base
}

/** An element's own annotations as multiline `key: value` (one per line). */
function annotationsCell(ov: ElementOverride | undefined): string {
  return Object.entries(ov?.annotations ?? {})
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")
}

const multiplicity = (min: number, max: number | null) => `[${min}..${max === null ? "*" : max}]`

/**
 * The MIG's name for the Source column, with its message identifier and/or short
 * code stripped out if they're embedded in the name (e.g. "pacs.008.001.08 EPC"
 * → "EPC"). The full identifier is removed before the short code (which is its
 * prefix). Falls back to the raw name if stripping would leave it empty.
 */
function migSourceName(mig: MessageImplementationGuide): string {
  const id = mig.messageIdentifier
  let name = mig.name
  if (id) name = name.split(id).join("")
  const short = shortCodeForIdentifier(id)
  if (short) name = name.split(short).join("")
  const cleaned = name
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s\-_:|.]+|[\s\-_:|.]+$/g, "")
    .trim()
  return cleaned || mig.name
}

/**
 * The element's name path as an indented multiline tree — one ancestor *name*
 * (not tag) per line, indented with `+`×depth, the root element skipped. E.g.
 * `+GroupHeader\n++ControlSum`. Blank for the root.
 */
function namePath(names: string[]): string {
  return names
    .slice(1)
    .map((name, i) => "+".repeat(i + 1) + name)
    .join("\n")
}

export function buildMigCsvRows(
  mig: MessageImplementationGuide,
  allMigs: MessageImplementationGuide[],
  message: MessageDefinition,
): { columns: string[]; rows: string[][] } {
  const { mig: eff, chain } = effectiveMig(mig, allMigs)
  const overrides = eff.elementOverrides
  const annotationNames = eff.constraintAnnotationNames ?? []
  const columns = [...COMMON_COLUMNS, ...RULE_COLUMNS, ...annotationNames]
  const leafIndex = chain.length - 1

  // The most-descendant chain layer whose override at `path` satisfies `has`,
  // named by its MIG (this MIG or an ancestor) for consistency with "ISO".
  const sourceFor = (path: string, has: (ov: ElementOverride) => boolean): string => {
    for (let i = leafIndex; i >= 0; i--) {
      const ov = chain[i].elementOverrides[path]
      if (ov && has(ov)) return migSourceName(chain[i])
    }
    return migSourceName(mig)
  }

  const rows: string[][] = []
  const blankCommon = COMMON_COLUMNS.map(() => "")
  const blankAnnotations = annotationNames.map(() => "")

  const annotationCells = (c: Constraint): string[] =>
    annotationNames.map((name) => c.annotations?.[name] ?? "")

  const ruleRow = (
    source: string,
    rule: string,
    definition: string,
    expression: string,
    annotations: string[],
  ): string[] => [...blankCommon, source, rule, definition, expression, ...annotations]

  // A disabled rule is marked in the Rule column.
  const ruleName = (name: string, disabled: boolean) => (disabled ? `${name} (disabled)` : name)

  const walk = (el: MessageElement, level: number, path: string, names: string[]) => {
    const ov = overrides[path]
    const iso = isoFacets(el)
    // Effective constraints (standard + added) with any overlay/disable applied.
    const resolved = resolveConstraints(el, ov)

    rows.push([
      String(level),
      el.isChoice ? "Y" : "",
      el.name,
      el.xmlTag,
      namePath(names),
      multiplicity(el.minOccurs, el.maxOccurs),
      typeString(el, iso),
      annotationsCell(ov),
      ...RULE_COLUMNS.map(() => ""),
      ...blankAnnotations,
    ])

    // ISO-defined constraints, with any MIG overlay (expression/definition/
    // disable) applied. Source stays "ISO" until this MIG (or an ancestor)
    // overlays the rule.
    for (const { constraint: c, disabled } of resolved.filter((r) => r.source === "standard")) {
      const overlaid = ov?.constraintOverrides?.[c.name] !== undefined
      const source = overlaid
        ? sourceFor(path, (o) => o.constraintOverrides?.[c.name] !== undefined)
        : "ISO"
      rows.push(ruleRow(source, ruleName(c.name, disabled), c.definition, c.expression ?? "", annotationCells(c)))
    }

    if (ov) {
      // Multiplicity override.
      const setsMin = "minOccurs" in ov && ov.minOccurs != null
      const setsMax = "maxOccurs" in ov && ov.maxOccurs != null
      if (setsMin || setsMax) {
        const effMin = setsMin ? (ov.minOccurs as number) : el.minOccurs
        const effMax = setsMax ? (ov.maxOccurs as number) : el.maxOccurs
        rows.push(
          ruleRow(
            sourceFor(path, (o) => "minOccurs" in o || "maxOccurs" in o),
            "Multiplicity",
            multiplicity(effMin, effMax),
            "",
            blankAnnotations,
          ),
        )
      }

      // Type override (any simple-type facet).
      if (TYPE_FACET_KEYS.some((k) => k in ov)) {
        rows.push(
          ruleRow(
            sourceFor(path, (o) => TYPE_FACET_KEYS.some((k) => k in o)),
            "Type",
            typeString(el, withOverride(iso, ov)),
            "",
            blankAnnotations,
          ),
        )
      }

      // Added constraints (effective: this MIG's plus inherited), overlay applied.
      for (const { constraint: c, disabled } of resolved.filter((r) => r.source === "additional")) {
        const source = sourceFor(path, (o) => (o.additionalConstraints ?? []).some((x) => x.name === c.name))
        rows.push(ruleRow(source, ruleName(c.name, disabled), c.definition, c.expression ?? "", annotationCells(c)))
      }
    }

    for (const child of el.elements) {
      walk(child, level + 1, `${path}/${child.xmlTag}`, [...names, child.name])
    }
  }

  walk(message.rootElement, 0, message.rootElement.xmlTag, [message.rootElement.name])
  return { columns, rows }
}

/** Quote a CSV field per RFC 4180 when it contains a comma, quote, or newline. */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

const csvLine = (cells: string[]) => cells.map(csvField).join(",")

/** Build the CSV export for one MIG: the message tree annotated with its rules. */
export function buildMigCsv(
  mig: MessageImplementationGuide,
  allMigs: MessageImplementationGuide[],
  message: MessageDefinition,
): { filename: string; content: string } {
  const { columns, rows } = buildMigCsvRows(mig, allMigs, message)
  const content = [columns, ...rows].map(csvLine).join("\r\n") + "\r\n"
  return { filename: `${mig.name}-${mig.version}.csv`, content }
}
