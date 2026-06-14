// Canonical MessageDefinition → YAML serialization: a readable, diff-stable
// snapshot of a standard ISO 20022 message's structure, for reference and for
// diffing one version against another. Pure — no DOM.
//
// Conventions mirror the MIG serializer (`core/mig/serializeMig.ts`):
// deterministic key order, block literals for multi-line text, no line wrapping
// or anchors, 2-space indent, trailing newline.
//   - Internal XMI ids (`id`, `typeId`) are **dropped** — they're
//     repository-build-volatile and meaningless outside the app, so keeping them
//     would only churn diffs; the human-readable `type` name is kept instead.
//   - `maxOccurs: null` is **preserved** (it means *unbounded*). Every other null
//     facet and every empty collection is omitted, so each element shows only
//     what actually constrains it.
//   - `isAttribute` / `isChoice` are emitted only when `true`.

import { stringify } from "yaml"
import type {
  Code,
  Constraint,
  MessageDefinition,
  MessageElement,
} from "@/core/types/types"

const STRINGIFY_OPTIONS = {
  lineWidth: 0,
  aliasDuplicateObjects: false,
  indent: 2,
} as const

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Scalar facet keys, emitted verbatim in this order when non-null. */
const FACET_KEYS = [
  "minInclusive",
  "maxInclusive",
  "totalDigits",
  "fractionDigits",
  "length",
  "minLength",
  "maxLength",
  "pattern",
  "baseValue",
] as const

/** One code → plain object (its definition dropped when empty). */
function canonicalCode(code: Code): Record<string, unknown> {
  const out: Record<string, unknown> = { codeName: code.codeName }
  if (code.definition) out.definition = code.definition
  return out
}

/** One constraint → plain object: name, definition, then optional expression/annotations. */
function canonicalConstraint(c: Constraint): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: c.name,
    definition: c.definition,
  }
  if (c.expression) out.expression = c.expression
  const names = Object.keys(c.annotations ?? {}).sort(byString)
  if (names.length > 0) {
    const annotations: Record<string, string | null> = {}
    for (const n of names) annotations[n] = c.annotations![n]
    out.annotations = annotations
  }
  return out
}

/** One element → plain object in canonical key order; children recurse last. */
function canonicalElement(el: MessageElement): Record<string, unknown> {
  const out: Record<string, unknown> = { name: el.name, xmlTag: el.xmlTag }
  if (el.isAttribute) out.isAttribute = true
  if (el.isChoice) out.isChoice = true
  out.type = el.type
  if (el.baseType) out.baseType = el.baseType
  out.minOccurs = el.minOccurs
  out.maxOccurs = el.maxOccurs // null = unbounded (preserved, unlike other nulls)
  if (el.definition) out.definition = el.definition
  for (const key of FACET_KEYS) {
    const v = el[key]
    if (v !== null) out[key] = v
  }
  if (el.codes.length > 0) out.codes = el.codes.map(canonicalCode)
  if (el.constraints.length > 0)
    out.constraints = el.constraints.map(canonicalConstraint)
  if (el.examples.length > 0) out.examples = [...el.examples]
  if (el.elements.length > 0) out.elements = el.elements.map(canonicalElement)
  return out
}

const withTrailingNewline = (s: string) => s.replace(/\n*$/, "\n")

/** Serialize a standard message definition to canonical YAML. */
export function serializeMessage(message: MessageDefinition): string {
  const out = {
    formatVersion: 1,
    name: message.name,
    identifier: message.identifier,
    shortCode: message.shortCode,
    rootElement: canonicalElement(message.rootElement),
  }
  return withTrailingNewline(stringify(out, STRINGIFY_OPTIONS))
}
