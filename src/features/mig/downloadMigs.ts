import { buildMigMarkdown } from "@/core/mig/migMarkdown"
import { buildMigCsv } from "@/core/mig/migCsv"
import { serializeMig, serializeMigs } from "@/core/mig/serializeMig"
import { CSV, MARKDOWN, saveTextFile, YAML } from "@/lib/saveFile"
import type {
  MessageDefinition,
  MessageImplementationGuide,
} from "@/core/types/types"

/**
 * Build the YAML download for one or many MIGs (canonical form):
 * a single MIG → its own object named `<name>-<version>.yaml`; many → an array
 * in `MessageImplementationGuides.yaml`. Returns `null` for an empty selection.
 * `pathOrder` (from `buildPathOrder`) schema-orders a single MIG's overrides;
 * the array form falls back to alphabetical path order.
 */
export function buildMigDownload(
  migs: MessageImplementationGuide[],
  pathOrder?: Map<string, number>
): { filename: string; content: string } | null {
  if (migs.length === 0) return null
  if (migs.length === 1) {
    const mig = migs[0]
    return {
      filename: `${mig.name}-${mig.version}.yaml`,
      content: serializeMig(mig, pathOrder),
    }
  }
  return {
    filename: "MessageImplementationGuides.yaml",
    content: serializeMigs(migs),
  }
}

/** Trigger a browser download of the selected MIGs as canonical YAML. */
export async function downloadMigs(
  migs: MessageImplementationGuide[],
  pathOrder?: Map<string, number>
): Promise<void> {
  const file = buildMigDownload(migs, pathOrder)
  if (file) await saveTextFile(file, YAML)
}

/**
 * Trigger a browser download of a MIG's human-readable Markdown report — the
 * effective overlay (this MIG + parent chain) diffed against the ISO message.
 */
export async function downloadMigMarkdown(
  mig: MessageImplementationGuide,
  allMigs: MessageImplementationGuide[],
  message: MessageDefinition
): Promise<void> {
  await saveTextFile(buildMigMarkdown(mig, allMigs, message), MARKDOWN)
}

/**
 * Trigger a browser download of a MIG's CSV — the ISO message tree flattened with
 * the MIG's effective rules (opens in Excel).
 */
export async function downloadMigCsv(
  mig: MessageImplementationGuide,
  allMigs: MessageImplementationGuide[],
  message: MessageDefinition
): Promise<void> {
  await saveTextFile(buildMigCsv(mig, allMigs, message), CSV)
}
