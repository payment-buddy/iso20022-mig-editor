// MIG search.
//
// Searches what a MIG *authors*: its name/description and its element-override
// layer (definitions, patterns, allowed values, examples, annotations, added
// constraints, constraint overlays). It deliberately does NOT match the
// underlying standard message fields — those belong to the Messages scope, and
// folding them in here would flood results with the same ISO names repeated per
// MIG. Element names for display are resolved from the base message.

import { elementAtPath } from "@/core/erepository/elementPath"
import { getMigKey } from "@/core/mig/migKey"
import type {
  ERepository,
  MessageDefinition,
  MessageImplementationGuide,
} from "@/core/types/types"
import { makeSnippet } from "./snippet"
import {
  constraintText,
  FIELD_RANK,
  lastSegment,
  matchesQuery,
  MIN_QUERY,
  normalizeQuery,
  type HitField,
  type MigHit,
} from "./search"

/** Find a message definition by exact identifier, scanning every business area. */
function findMessage(
  repo: ERepository,
  identifier: string
): MessageDefinition | undefined {
  for (const area of repo.businessAreas) {
    const msg = area.messages.find((m) => m.identifier === identifier)
    if (msg) return msg
  }
  return undefined
}

/**
 * Search the authored content of every MIG for `query`. Returns `[]` for queries
 * shorter than `MIN_QUERY`. Ranked by field (structural before prose) then MIG
 * name; capped at `limit`.
 */
export function searchMigs(
  repo: ERepository,
  migs: MessageImplementationGuide[],
  query: string,
  limit = 100
): MigHit[] {
  // Keep edge spaces for word-boundary matching; gate on the trimmed length.
  const q = normalizeQuery(query)
  if (q.trim().length < MIN_QUERY) return []

  // Resolve each target message once per call (multiple MIGs may share one).
  const messageCache = new Map<string, MessageDefinition | undefined>()
  const messageFor = (identifier: string) => {
    if (!messageCache.has(identifier))
      messageCache.set(identifier, findMessage(repo, identifier))
    return messageCache.get(identifier)
  }

  const hits: MigHit[] = []
  for (const mig of migs) {
    const migKey = getMigKey(mig)
    const root = messageFor(mig.messageIdentifier)?.rootElement
    const elementName = (xmlPath: string) =>
      (root && elementAtPath(root, xmlPath)?.name) || lastSegment(xmlPath)

    const base = {
      migKey,
      migName: mig.name,
      migVersion: mig.version,
      messageIdentifier: mig.messageIdentifier,
    }
    const add = (
      field: HitField,
      value: string,
      where?: { xmlPath: string; detail?: string }
    ) => {
      if (!value || !matchesQuery(value.toLowerCase(), q)) return
      hits.push({
        ...base,
        field,
        snippet: makeSnippet(value, q),
        ...(where
          ? {
              xmlPath: where.xmlPath,
              elementName: elementName(where.xmlPath),
              detail: where.detail,
            }
          : {}),
      })
    }

    add("name", mig.name)
    if (mig.description) add("description", mig.description)

    for (const [xmlPath, ov] of Object.entries(mig.elementOverrides)) {
      const at = (field: HitField, value: string, detail?: string) =>
        add(field, value, { xmlPath, detail })

      if (typeof ov.definition === "string") at("definition", ov.definition)
      if (typeof ov.pattern === "string") at("pattern", ov.pattern)
      if (ov.allowedValues?.length)
        at("allowedValue", ov.allowedValues.join(", "))
      if (ov.examples?.length) at("example", ov.examples.join(", "))
      for (const [name, value] of Object.entries(ov.annotations ?? {}))
        at("annotation", `${name}: ${value}`, name)
      for (const c of ov.additionalConstraints ?? []) {
        at("constraint", constraintText(c), c.name)
        // Annotation values on the constraint itself — navigate to the
        // constraint node (where they're edited), not just its element.
        const constraintPath = `${xmlPath}/${c.name}`
        for (const [name, value] of Object.entries(c.annotations ?? {}))
          if (value)
            add("annotation", `${name}: ${value}`, {
              xmlPath: constraintPath,
              detail: name,
            })
      }
      for (const [name, co] of Object.entries(ov.constraintOverrides ?? {})) {
        const value = [name, co.definition, co.expression]
          .filter(Boolean)
          .join(" — ")
        at("constraint", value, name)
      }
    }
  }

  hits.sort((a, b) => {
    const rank = FIELD_RANK[a.field] - FIELD_RANK[b.field]
    if (rank !== 0) return rank
    const name = a.migName.localeCompare(b.migName)
    if (name !== 0) return name
    return (a.xmlPath ?? "").localeCompare(b.xmlPath ?? "")
  })

  return hits.slice(0, limit)
}
