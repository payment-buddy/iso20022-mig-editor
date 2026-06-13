import { stringify } from "yaml"
import type { MessageImplementationGuide } from "@/core/types/types"

/**
 * Build the YAML download for one or many MIGs: a single MIG → its own object
 * named `<name>-<version>.yaml`; many → an array in `MessageImplementationGuides.yaml`.
 * Returns `null` for an empty selection. (Canonical normalization is Phase 5;
 * this is a plain serialization.)
 */
export function buildMigDownload(
  migs: MessageImplementationGuide[],
): { filename: string; content: string } | null {
  if (migs.length === 0) return null
  if (migs.length === 1) {
    const mig = migs[0]
    return { filename: `${mig.name}-${mig.version}.yaml`, content: stringify(mig) }
  }
  return { filename: "MessageImplementationGuides.yaml", content: stringify(migs) }
}

/** Trigger a browser download of the selected MIGs as YAML. */
export function downloadMigs(migs: MessageImplementationGuide[]): void {
  const file = buildMigDownload(migs)
  if (!file) return
  const url = URL.createObjectURL(new Blob([file.content], { type: "text/yaml" }))
  const a = document.createElement("a")
  a.href = url
  a.download = file.filename
  a.click()
  URL.revokeObjectURL(url)
}
