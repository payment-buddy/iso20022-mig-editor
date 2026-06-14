import { parseAllDocuments } from "yaml"
import { validateMigImport } from "@/core/mig/validateMigImport"
import type { MessageImplementationGuide } from "@/core/types/types"

export type ParseResult = {
  migs: MessageImplementationGuide[]
  errors: string[]
}

/**
 * Parse MIG YAML text into validated MIGs. Accepts a single MIG, a
 * multi-document stream (`---`-separated, the bulk/backup form), or the legacy
 * single-document YAML array. Each entry is checked with `validateMigImport`
 * (Zod): valid MIGs are returned, malformed ones are skipped and reported as
 * readable error lines for the caller to surface. An empty file yields no MIGs,
 * no errors.
 */
export function parseMigYaml(text: string): ParseResult {
  let docs
  try {
    docs = parseAllDocuments(text)
  } catch {
    return { migs: [], errors: ["The file isn't valid YAML."] }
  }
  if (docs.some((doc) => doc.errors.length > 0)) {
    return { migs: [], errors: ["The file isn't valid YAML."] }
  }

  // One MIG per document; a legacy backup is a single document holding a YAML
  // array of MIGs, so flatten arrays. Empty documents are ignored.
  const items: unknown[] = []
  for (const doc of docs) {
    const value = doc.toJS()
    if (value == null) continue
    if (Array.isArray(value)) items.push(...value)
    else items.push(value)
  }
  if (items.length === 0) return { migs: [], errors: [] }

  const migs: MessageImplementationGuide[] = []
  const errors: string[] = []
  items.forEach((item, i) => {
    const result = validateMigImport(item)
    if (result.ok) {
      migs.push(result.mig)
    } else {
      const prefix = items.length > 1 ? `Entry ${i + 1} — ` : ""
      for (const message of result.errors) errors.push(prefix + message)
    }
  })
  return { migs, errors }
}
