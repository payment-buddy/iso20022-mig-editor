// Export a MIG as CSV (FUNCTIONALITY §10 — "Markdown + CSV", CSV opens in Excel).
// The whole ISO message tree is flattened in document order: one row per element
// (structure + ISO type), then one row per rule (ISO constraints, the MIG's
// multiplicity/type overrides, and added constraints) with its provenance. Pure.
//
// Layout — common columns describe the element and are blank on rule rows:
//   Level | Choice | Name | XML tag | XML path | Multiplicity | Type
// rule columns are blank on the element row:
//   Source | Rule | Definition | <one column per constraint-annotation name>
//
// Source provenance: "ISO" (rule from the message definition), the parent MIG's
// name (a rule inherited from the chain), or "MIG" (set in this MIG). Computed
// from the effective parent chain (ancestor→leaf, leaf = this MIG).

import { effectiveMig } from "./effectiveMig"
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

const COMMON_COLUMNS = ["Level", "Choice", "Name", "XML tag", "XML path", "Multiplicity", "Type"]
const RULE_COLUMNS = ["Source", "Rule", "Definition"]

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
  const base = el.baseType ?? el.type ?? ""
  const facet = facetString(facets)
  return facet ? `${base}[${facet}]` : base
}

const multiplicity = (min: number, max: number | null) => `[${min}..${max === null ? "*" : max}]`

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

  // The most-descendant chain layer whose override at `path` satisfies `has`.
  const sourceFor = (path: string, has: (ov: ElementOverride) => boolean): string => {
    for (let i = leafIndex; i >= 0; i--) {
      const ov = chain[i].elementOverrides[path]
      if (ov && has(ov)) return i === leafIndex ? "MIG" : chain[i].name
    }
    return "MIG"
  }

  const rows: string[][] = []

  const annotationCells = (c: Constraint): string[] =>
    annotationNames.map((name) => c.annotations?.[name] ?? "")

  const ruleRow = (source: string, rule: string, definition: string, annotations: string[]): string[] => [
    "", "", "", "", "", "", "", // blank common columns
    source,
    rule,
    definition,
    ...annotations,
  ]

  const walk = (el: MessageElement, level: number, path: string) => {
    const ov = overrides[path]
    const iso = isoFacets(el)

    rows.push([
      String(level),
      el.isChoice ? "Y" : "",
      el.name,
      el.xmlTag,
      path,
      multiplicity(el.minOccurs, el.maxOccurs),
      typeString(el, iso),
      "", "", "", // blank rule columns
      ...annotationNames.map(() => ""),
    ])

    // ISO-defined constraints.
    for (const c of el.constraints) {
      rows.push(ruleRow("ISO", c.name, c.definition, annotationCells(c)))
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
            annotationNames.map(() => ""),
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
            annotationNames.map(() => ""),
          ),
        )
      }

      // Added constraints.
      for (const c of ov.additionalConstraints ?? []) {
        const source = sourceFor(path, (o) => (o.additionalConstraints ?? []).some((x) => x.name === c.name))
        rows.push(ruleRow(source, c.name, c.definition || c.expression || "", annotationCells(c)))
      }
    }

    for (const child of el.elements) walk(child, level + 1, `${path}/${child.xmlTag}`)
  }

  walk(message.rootElement, 0, message.rootElement.xmlTag)
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
