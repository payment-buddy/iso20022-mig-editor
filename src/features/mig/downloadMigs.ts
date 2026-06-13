import { serializeMig, serializeMigs } from "@/core/mig/serializeMig"
import type { MessageImplementationGuide } from "@/core/types/types"

/**
 * Build the YAML download for one or many MIGs (canonical MIG_FORMAT.md form):
 * a single MIG → its own object named `<name>-<version>.yaml`; many → an array
 * in `MessageImplementationGuides.yaml`. Returns `null` for an empty selection.
 * `pathOrder` (from `buildPathOrder`) schema-orders a single MIG's overrides;
 * the array form falls back to alphabetical path order.
 */
export function buildMigDownload(
  migs: MessageImplementationGuide[],
  pathOrder?: Map<string, number>,
): { filename: string; content: string } | null {
  if (migs.length === 0) return null
  if (migs.length === 1) {
    const mig = migs[0]
    return { filename: `${mig.name}-${mig.version}.yaml`, content: serializeMig(mig, pathOrder) }
  }
  return { filename: "MessageImplementationGuides.yaml", content: serializeMigs(migs) }
}

/** Trigger a browser download of the selected MIGs as YAML. */
export function downloadMigs(
  migs: MessageImplementationGuide[],
  pathOrder?: Map<string, number>,
): void {
  const file = buildMigDownload(migs, pathOrder)
  if (!file) return
  const url = URL.createObjectURL(new Blob([file.content], { type: "text/yaml" }))
  const a = document.createElement("a")
  a.href = url
  a.download = file.filename
  a.click()
  URL.revokeObjectURL(url)
}
