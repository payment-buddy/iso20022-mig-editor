import { parse } from "yaml"
import { validateMigImport } from "@/core/mig/validateMigImport"
import type { MessageImplementationGuide } from "@/core/types/types"

export type ParseResult = { migs: MessageImplementationGuide[]; errors: string[] }

/**
 * Parse MIG YAML text into validated MIGs. Accepts a single MIG or an array
 * (bulk/backup form). Each entry is checked with `validateMigImport` (Zod):
 * valid MIGs are returned, malformed ones are skipped and reported as readable
 * error lines for the caller to surface. An empty file yields no MIGs, no errors.
 */
export function parseMigYaml(text: string): ParseResult {
  let parsed: unknown
  try {
    parsed = parse(text)
  } catch {
    return { migs: [], errors: ["The file isn't valid YAML."] }
  }
  if (parsed == null) return { migs: [], errors: [] }

  const items = Array.isArray(parsed) ? parsed : [parsed]
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
