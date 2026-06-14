// Shared model for the two global searches (Message Definitions and MIGs).
//
// Both searches reduce their domain to *field matches*: a located, labelled,
// snippet-able hit on one text-bearing field. The message search additionally
// folds matches across a message's many near-identical versions into deduped
// rows with per-value version clusters (see `searchMessages.ts`); the MIG search
// has no versions to fold (each MIG is its own result). Keep this file free of
// React/DOM so the matchers stay unit-testable in isolation.

import type { Constraint } from "@/core/types/types"
import type { Snippet } from "./snippet"

/** The two independent search domains, toggled in the palette. */
export type SearchScope = "migs" | "messages"

/**
 * Which text-bearing field matched. Drives the result badge label and the
 * relevance ordering (structural fields rank above prose).
 */
export type HitField =
  | "name"
  | "xmlTag"
  | "definition"
  | "type"
  | "pattern"
  | "example"
  | "code"
  | "constraint"
  | "annotation"
  | "allowedValue"
  | "description"

/** Lower sorts first: a name/tag hit outranks a buried definition hit. */
export const FIELD_RANK: Record<HitField, number> = {
  name: 0,
  xmlTag: 1,
  code: 2,
  allowedValue: 2,
  constraint: 3,
  annotation: 4,
  type: 5,
  pattern: 6,
  example: 7,
  description: 8,
  definition: 9,
}

/** Human label for a field badge; `detail` refines it (annotation/constraint name). */
export function fieldLabel(field: HitField, detail?: string): string {
  switch (field) {
    case "name":
      return "Name"
    case "xmlTag":
      return "XML tag"
    case "definition":
      return "Definition"
    case "type":
      return "Type"
    case "pattern":
      return "Pattern"
    case "example":
      return "Example"
    case "code":
      return "Code"
    case "constraint":
      return detail ? `Rule: ${detail}` : "Rule"
    case "annotation":
      return detail ? `Annotation: ${detail}` : "Annotation"
    case "allowedValue":
      return "Allowed values"
    case "description":
      return "Description"
  }
}

/** The last `/`-segment of an xmlPath (a readable element name fallback). */
export function lastSegment(xmlPath: string): string {
  const i = xmlPath.lastIndexOf("/")
  return i === -1 ? xmlPath : xmlPath.slice(i + 1)
}

/** Flatten a constraint into one searchable line: name, definition, expression. */
export function constraintText(c: Constraint): string {
  return [c.name, c.definition, c.expression].filter(Boolean).join(" — ")
}

/**
 * The tree path a hit should select. Constraint hits target the constraint node
 * (`<element>/<constraintName>`); every other field targets its element.
 */
export function hitTargetPath(
  xmlPath: string,
  field: HitField,
  detail?: string
): string {
  return field === "constraint" && detail ? `${xmlPath}/${detail}` : xmlPath
}

/** Minimum query length — below this the searches return nothing (too broad). */
export const MIN_QUERY = 3

/**
 * Normalize a raw query for matching: case-fold only, deliberately **keeping
 * edge spaces**. A leading and/or trailing space lets the user anchor a *whole
 * word* (a word boundary) instead of a prefix; an interior space stays a phrase
 * search. The `MIN_QUERY` gate is applied to the trimmed length, so a query that
 * is only a word plus a space (e.g. `"ab "`) still counts as its trimmed length.
 */
export function normalizeQuery(raw: string): string {
  return raw.toLowerCase()
}

/**
 * Does the already-lowercased `lowerText` contain the normalized query `q`? An
 * edge space in `q` is treated as a word boundary that also matches the *start
 * or end* of the value: we test against `lowerText` wrapped in sentinel spaces.
 * So `" amount "` matches the field `Amount` and the phrase `amount due`, but not
 * `amounts`. For a query with no edge spaces this is exactly `lowerText.includes(q)`
 * — a wrapping space can only create matches for a query that itself starts or
 * ends with a space.
 */
export function matchesQuery(lowerText: string, q: string): boolean {
  return (" " + lowerText + " ").includes(q)
}

// --- Result shapes ---

/** One message version that holds a given value, for a chip link. */
export interface VersionRef {
  identifier: string
  /** Trailing dotted segment, e.g. `08` — compact chip label. */
  short: string
}

/** A distinct field value and every version (newest-first) that shares it. */
export interface ValueCluster {
  snippet: Snippet
  versions: VersionRef[]
}

/**
 * A deduped Message-Definition hit: one element field across a message family
 * (`shortCode`), with its matching values grouped into version clusters.
 */
export interface MessageHit {
  shortCode: string
  messageName: string
  area: string
  xmlPath: string
  elementName: string
  field: HitField
  detail?: string
  /** Identical values folded together; ordered newest-cluster first. */
  clusters: ValueCluster[]
  /** Newest identifier holding this hit — the default navigation target. */
  latestIdentifier: string
}

/** A MIG hit: one authored field, on the MIG itself or one of its overrides. */
export interface MigHit {
  migKey: string
  migName: string
  migVersion: string
  messageIdentifier: string
  /** Set for element-override hits; absent for MIG-level (name/description). */
  xmlPath?: string
  elementName?: string
  field: HitField
  detail?: string
  snippet: Snippet
}
