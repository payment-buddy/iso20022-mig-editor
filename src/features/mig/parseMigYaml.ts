import { parse } from "yaml"
import type { MessageImplementationGuide } from "@/core/types/types"

/**
 * Parse MIG YAML text into MIGs. Accepts a single MIG or an array (legacy format).
 * Bare-minimum: no schema validation (Phase 3 adds `validateMigImport`); it only
 * drops non-object entries so a malformed file can't crash the caller.
 */
export function parseMigYaml(text: string): MessageImplementationGuide[] {
  const parsed: unknown = parse(text)
  const items = Array.isArray(parsed) ? parsed : [parsed]
  return items.filter(
    (item): item is MessageImplementationGuide => item != null && typeof item === "object",
  )
}
