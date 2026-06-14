import { buildMigMarkdown } from "@/core/mig/migMarkdown"
import { buildMigsXlsx, buildMigXlsx } from "@/core/mig/migXlsx"
import { serializeMig, serializeMigs } from "@/core/mig/serializeMig"
import { MARKDOWN, saveTextFile, XLSX, YAML } from "@/lib/saveFile"
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
 * Trigger a browser download of a MIG's Excel workbook — the ISO message tree
 * flattened with the MIG's effective rules, rows tinted by constraint provenance.
 */
export async function downloadMigExcel(
  mig: MessageImplementationGuide,
  allMigs: MessageImplementationGuide[],
  message: MessageDefinition
): Promise<void> {
  await saveTextFile(buildMigXlsx(mig, allMigs, message), XLSX)
}

/**
 * Trigger a browser download of several MIGs as one Excel workbook (one sheet per
 * MIG). `messageFor` resolves each MIG's ISO message; MIGs whose message can't be
 * resolved are skipped. No-op when nothing resolves.
 */
export async function downloadMigsExcel(
  migs: MessageImplementationGuide[],
  allMigs: MessageImplementationGuide[],
  messageFor: (mig: MessageImplementationGuide) => MessageDefinition | null
): Promise<void> {
  const entries = migs.flatMap((mig) => {
    const message = messageFor(mig)
    return message ? [{ mig, message }] : []
  })
  const file = buildMigsXlsx(entries, allMigs)
  if (file) await saveTextFile(file, XLSX)
}
