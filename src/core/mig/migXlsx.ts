// Export a MIG as a styled Excel workbook (`.xlsx`). The whole ISO message tree
// is flattened in document order: one row per element (structure + ISO type),
// then one row per rule (ISO constraints — with any MIG expression/definition
// overlay or disable applied — the MIG's multiplicity/type overrides, and added
// constraints) with its provenance. A disabled rule is marked "(disabled)" in
// the Rule column. Pure.
//
// Rows are tinted by constraint provenance, matching the merge/compare diff
// colors: a rule this MIG sets itself is light green (like an "added" field) and
// a rule inherited from an ancestor MIG is light blue (like a "changed" field).
// Removed things are light gray with muted text: a disabled rule and an element
// excluded by the MIG (effective `maxOccurs: 0`). ISO rows left untouched by the
// MIG are uncolored.
//
// Layout — common columns describe the element and are blank on rule rows
// (`Path` is an indented multiline name tree, root skipped; `Annotations` holds
// the element's own annotations as multiline `key: value`):
//   Level | Choice | Name | XML tag | Path | Multiplicity | Type | Annotations
// rule columns are blank on the element row:
//   Provenance | Rule | Definition | <one column per constraint annotation>
//
// Provenance: "ISO" (rule from the message definition) or a MIG name — this MIG's
// own name when it set the rule, or an ancestor's when inherited. Computed from
// the effective parent chain (ancestor→leaf, leaf = this MIG).

import { effectiveMig } from "./effectiveMig"
import { resolveConstraints } from "./constraints"
import { rootPath } from "@/core/erepository/elementPath"
import { shortCodeForIdentifier } from "@/core/erepository/messageIdentifier"
import {
  writeXlsx,
  writeXlsxWorkbook,
  type XlsxColumn,
  type XlsxSheet,
} from "@/core/utils/xlsx"
import type {
  Constraint,
  ElementOverride,
  MessageDefinition,
  MessageElement,
  MessageImplementationGuide,
} from "@/core/types/types"

// Provenance of a row, driving both the Provenance column and its background tint.
//   element   — an element row that the MIG does not exclude (uncolored)
//   excluded  — an element the MIG removes (effective maxOccurs 0): gray + muted
//   iso       — an ISO rule the MIG leaves untouched (uncolored)
//   own       — a rule this MIG sets / overlays: light green ("added")
//   inherited — a rule inherited from an ancestor MIG: light blue ("changed")
//   disabled  — a rule the MIG disables / removes: gray + muted ("removed")
export type RowKind =
  | "element"
  | "excluded"
  | "iso"
  | "own"
  | "inherited"
  | "disabled"

export interface ExportRow {
  kind: RowKind
  cells: string[]
}

// Light tints mirroring the merge/compare diff colors (added → green,
// changed → blue). Removed things (disabled rules, excluded elements) are gray.
// `null` = no fill.
const REMOVED_FILL = "E5E7EB" // gray — disabled rule / excluded element
const FILL_FOR_KIND: Record<RowKind, string | null> = {
  element: null,
  iso: null,
  own: "D1FAE5", // green — this MIG adds/sets the rule
  inherited: "DBEAFE", // blue — inherited from an ancestor MIG
  disabled: REMOVED_FILL,
  excluded: REMOVED_FILL,
}

// Muted gray text for "removed" rows, echoing the UI's muted-foreground.
const MUTED_TEXT = "6B7280"
const FONT_COLOR_FOR_KIND: Record<RowKind, string | null> = {
  element: null,
  iso: null,
  own: null,
  inherited: null,
  disabled: MUTED_TEXT,
  excluded: MUTED_TEXT,
}

export const fillForKind = (kind: RowKind): string | null => FILL_FOR_KIND[kind]

export const fontColorForKind = (kind: RowKind): string | null =>
  FONT_COLOR_FOR_KIND[kind]

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

// Common (element) columns. The "Annotations" column holds the element's own
// annotations as multiline `key: value`; it is appended only when the MIG
// configures element annotation names (see `buildMigExportRows`). Rule columns
// describe one constraint/override.
const COMMON_COLUMNS = [
  "Level",
  "Choice",
  "Name",
  "XML tag",
  "Path",
  "Multiplicity",
  "Type",
]
const ANNOTATIONS_COLUMN = "Annotations"
const RULE_COLUMNS = ["Provenance", "Rule", "Definition"]

// Excel column widths (character units) by header; constraint-annotation columns
// (and any unlisted header) fall back to the default.
const COLUMN_WIDTHS: Record<string, number> = {
  Level: 6,
  Choice: 7,
  Name: 22,
  "XML tag": 14,
  Path: 28,
  Multiplicity: 12,
  Type: 22,
  Annotations: 30,
  Provenance: 16,
  Rule: 18,
  Definition: 40,
}
const DEFAULT_WIDTH = 20

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
  if ("allowedValues" in ov && ov.allowedValues != null)
    g.codes = ov.allowedValues
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
  if (f.totalDigits != null || f.fractionDigits != null)
    return `${f.totalDigits ?? ""}.${f.fractionDigits ?? ""}`
  if (f.length != null && f.minLength == null && f.maxLength == null)
    return String(f.length)
  if (f.minLength != null || f.maxLength != null)
    return `${f.minLength ?? ""}..${f.maxLength ?? ""}`
  if (f.minInclusive != null || f.maxInclusive != null)
    return `${f.minInclusive ?? ""}..${f.maxInclusive ?? ""}`
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

const multiplicity = (min: number, max: number | null) =>
  `[${min}..${max === null ? "*" : max}]`

/**
 * The MIG's name for the Provenance column, with its message identifier and/or short
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

export function buildMigExportRows(
  mig: MessageImplementationGuide,
  allMigs: MessageImplementationGuide[],
  message: MessageDefinition
): { columns: string[]; rows: ExportRow[] } {
  const { mig: eff, chain } = effectiveMig(mig, allMigs)
  const overrides = eff.elementOverrides
  const annotationNames = eff.constraintAnnotationNames ?? []
  // Only carry the element "Annotations" column when the MIG configures element
  // annotation names; otherwise there is nothing for it to hold.
  const includeAnnotations = (eff.elementAnnotationNames?.length ?? 0) > 0
  const commonColumns = includeAnnotations
    ? [...COMMON_COLUMNS, ANNOTATIONS_COLUMN]
    : COMMON_COLUMNS
  const columns = [...commonColumns, ...RULE_COLUMNS, ...annotationNames]
  const leafIndex = chain.length - 1

  // The most-descendant chain layer whose override at `path` satisfies `has`,
  // with its provenance: "own" when that layer is this MIG (the leaf),
  // "inherited" when it's an ancestor.
  const provenanceFor = (
    path: string,
    has: (ov: ElementOverride) => boolean
  ): { name: string; kind: "own" | "inherited" } => {
    for (let i = leafIndex; i >= 0; i--) {
      const ov = chain[i].elementOverrides[path]
      if (ov && has(ov))
        return {
          name: migSourceName(chain[i]),
          kind: i === leafIndex ? "own" : "inherited",
        }
    }
    return { name: migSourceName(mig), kind: "own" }
  }

  const rows: ExportRow[] = []
  const blankCommon = commonColumns.map(() => "")
  const blankAnnotations = annotationNames.map(() => "")

  const annotationCells = (c: Constraint): string[] =>
    annotationNames.map((name) => c.annotations?.[name] ?? "")

  const ruleRow = (
    kind: RowKind,
    source: string,
    rule: string,
    definition: string,
    annotations: string[]
  ): ExportRow => ({
    kind,
    cells: [...blankCommon, source, rule, definition, ...annotations],
  })

  // A disabled rule is marked in the Rule column.
  const ruleName = (name: string, disabled: boolean) =>
    disabled ? `${name} (disabled)` : name

  // The Choice column: a choice element is the branch point; each of its direct
  // children is one mutually-exclusive option under it.
  const choiceCell = (el: MessageElement, parentIsChoice: boolean) =>
    el.isChoice ? "Choice" : parentIsChoice ? "Option" : ""

  const walk = (
    el: MessageElement,
    level: number,
    path: string,
    names: string[],
    parentIsChoice: boolean
  ) => {
    const ov = overrides[path]
    const iso = isoFacets(el)
    const excluded = !!ov && "maxOccurs" in ov && ov.maxOccurs === 0
    // Effective constraints (standard + added) with any overlay/disable applied.
    const resolved = resolveConstraints(el, ov)

    rows.push({
      kind: excluded ? "excluded" : "element",
      cells: [
        String(level),
        choiceCell(el, parentIsChoice),
        el.name,
        el.xmlTag,
        namePath(names),
        multiplicity(el.minOccurs, el.maxOccurs),
        typeString(el, iso),
        ...(includeAnnotations ? [annotationsCell(ov)] : []),
        ...RULE_COLUMNS.map(() => ""),
        ...blankAnnotations,
      ],
    })

    // ISO-defined constraints, with any MIG overlay (expression/definition/
    // disable) applied. Provenance stays "ISO" until this MIG (or an ancestor)
    // overlays the rule.
    for (const { constraint: c, disabled } of resolved.filter(
      (r) => r.source === "standard"
    )) {
      const overlaid = ov?.constraintOverrides?.[c.name] !== undefined
      if (overlaid) {
        const prov = provenanceFor(
          path,
          (o) => o.constraintOverrides?.[c.name] !== undefined
        )
        rows.push(
          ruleRow(
            disabled ? "disabled" : prov.kind,
            prov.name,
            ruleName(c.name, disabled),
            c.definition,
            annotationCells(c)
          )
        )
      } else {
        rows.push(
          ruleRow(
            "iso",
            "ISO",
            ruleName(c.name, disabled),
            c.definition,
            annotationCells(c)
          )
        )
      }
    }

    if (ov) {
      // Multiplicity override.
      const setsMin = "minOccurs" in ov && ov.minOccurs != null
      const setsMax = "maxOccurs" in ov && ov.maxOccurs != null
      if (setsMin || setsMax) {
        const effMin = setsMin ? (ov.minOccurs as number) : el.minOccurs
        const effMax = setsMax ? (ov.maxOccurs as number) : el.maxOccurs
        const prov = provenanceFor(
          path,
          (o) => "minOccurs" in o || "maxOccurs" in o
        )
        rows.push(
          ruleRow(
            prov.kind,
            prov.name,
            "Multiplicity",
            multiplicity(effMin, effMax),
            blankAnnotations
          )
        )
      }

      // Type override (any simple-type facet).
      if (TYPE_FACET_KEYS.some((k) => k in ov)) {
        const prov = provenanceFor(path, (o) =>
          TYPE_FACET_KEYS.some((k) => k in o)
        )
        rows.push(
          ruleRow(
            prov.kind,
            prov.name,
            "Type",
            typeString(el, withOverride(iso, ov)),
            blankAnnotations
          )
        )
      }

      // Added constraints (effective: this MIG's plus inherited), overlay applied.
      for (const { constraint: c, disabled } of resolved.filter(
        (r) => r.source === "additional"
      )) {
        const prov = provenanceFor(path, (o) =>
          Object.prototype.hasOwnProperty.call(
            o.additionalConstraints ?? {},
            c.name
          )
        )
        rows.push(
          ruleRow(
            disabled ? "disabled" : prov.kind,
            prov.name,
            ruleName(c.name, disabled),
            c.definition,
            annotationCells(c)
          )
        )
      }
    }

    for (const child of el.elements) {
      walk(
        child,
        level + 1,
        `${path}/${child.xmlTag}`,
        [...names, child.name],
        el.isChoice === true
      )
    }
  }

  walk(
    message.rootElement,
    0,
    rootPath(message.rootElement),
    [message.rootElement.name],
    false
  )
  return { columns, rows }
}

/** Excel column widths for the export, by header (unlisted → default). */
function exportColumns(columns: string[]): XlsxColumn[] {
  return columns.map((title) => ({
    title,
    width: COLUMN_WIDTHS[title] ?? DEFAULT_WIDTH,
  }))
}

/**
 * One MIG's worksheet: the message tree annotated with its rules, rows tinted by
 * constraint provenance. `name` defaults to the message identifier (e.g.
 * `pacs.008.001.08`); a multi-MIG workbook overrides it per sheet so the tabs
 * stay distinct.
 */
export function migXlsxSheet(
  mig: MessageImplementationGuide,
  allMigs: MessageImplementationGuide[],
  message: MessageDefinition,
  name: string = message.identifier
): XlsxSheet {
  const { columns, rows } = buildMigExportRows(mig, allMigs, message)
  return {
    name,
    columns: exportColumns(columns),
    rows: rows.map((r) => ({
      cells: r.cells,
      fill: fillForKind(r.kind),
      fontColor: fontColorForKind(r.kind),
    })),
  }
}

/** Build the Excel export for one MIG (a single-sheet workbook). */
export function buildMigXlsx(
  mig: MessageImplementationGuide,
  allMigs: MessageImplementationGuide[],
  message: MessageDefinition
): { filename: string; content: Uint8Array } {
  return {
    filename: `${mig.name}-${mig.version}.xlsx`,
    content: writeXlsx(migXlsxSheet(mig, allMigs, message)),
  }
}

/**
 * Strip the leading whole words shared by every name, so the sheet tabs show only
 * what distinguishes the MIGs. Words are split on whitespace and dashes, e.g.
 * `["pacs.008-EPC-SCT", "pacs.008-EPC-Inst"]` → `["SCT", "Inst"]`. A name that is
 * exactly the common prefix keeps its full name (so no tab is left blank); fewer
 * than two names, or no shared prefix, returns the names unchanged.
 */
export function stripCommonWordPrefix(names: string[]): string[] {
  if (names.length < 2) return names
  const wordLists = names.map((n) => n.trim().split(/[\s-]+/))
  const minLen = Math.min(...wordLists.map((w) => w.length))
  let prefix = 0
  while (
    prefix < minLen &&
    wordLists.every((w) => w[prefix] === wordLists[0][prefix])
  )
    prefix++
  if (prefix === 0) return names
  return names.map((n, i) => wordLists[i].slice(prefix).join(" ") || n.trim())
}

/**
 * Build the Excel export for several MIGs: one sheet per MIG in a single workbook.
 * Tabs are named by message identifier when those are unique across the selection;
 * otherwise (multiple MIGs share a message) they fall back to the MIG names with
 * their common leading words stripped. A single MIG falls back to
 * {@link buildMigXlsx}. Returns `null` for an empty selection. Each entry carries
 * its MIG's resolved ISO message (MIGs may target different messages).
 */
export function buildMigsXlsx(
  entries: { mig: MessageImplementationGuide; message: MessageDefinition }[],
  allMigs: MessageImplementationGuide[]
): { filename: string; content: Uint8Array } | null {
  if (entries.length === 0) return null
  if (entries.length === 1)
    return buildMigXlsx(entries[0].mig, allMigs, entries[0].message)
  const identifiers = entries.map((e) => e.message.identifier)
  const identifiersUnique = new Set(identifiers).size === identifiers.length
  const names = identifiersUnique
    ? identifiers
    : stripCommonWordPrefix(entries.map((e) => e.mig.name))
  const sheets = entries.map(({ mig, message }, i) =>
    migXlsxSheet(mig, allMigs, message, names[i])
  )
  return {
    filename: "MessageImplementationGuides.xlsx",
    content: writeXlsxWorkbook(sheets),
  }
}
