import { buildMigMarkdown } from "@/core/mig/migMarkdown"
import { buildMigCsv } from "@/core/mig/migCsv"
import { serializeMig, serializeMigs } from "@/core/mig/serializeMig"
import type { MessageDefinition, MessageImplementationGuide } from "@/core/types/types"

/**
 * Build the YAML download for one or many MIGs (canonical form):
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

type SavedFile = { filename: string; content: string }
type FileKind = { mime: string; description: string; extensions: string[] }

const YAML: FileKind = { mime: "text/yaml", description: "YAML", extensions: [".yaml", ".yml"] }
const MARKDOWN: FileKind = { mime: "text/markdown", description: "Markdown", extensions: [".md"] }
const CSV: FileKind = { mime: "text/csv", description: "CSV", extensions: [".csv"] }

/**
 * Minimal slice of the File System Access API we use — not in every lib.dom, and
 * not supported by every browser, so it's feature-detected at call time.
 */
type ShowSaveFilePicker = (options?: {
  suggestedName?: string
  types?: { description?: string; accept: Record<string, string[]> }[]
}) => Promise<{
  createWritable: () => Promise<{
    write: (data: string) => Promise<void>
    close: () => Promise<void>
  }>
}>

/**
 * Save via `showSaveFilePicker` (File System Access API): the user picks the
 * location and an existing file is overwritten in place — no `" (1)"` suffix.
 * Returns `false` when the API is unavailable so the caller can fall back.
 */
async function saveViaPicker(file: SavedFile, kind: FileKind): Promise<boolean> {
  const picker = (window as unknown as { showSaveFilePicker?: ShowSaveFilePicker })
    .showSaveFilePicker
  if (!picker) return false
  try {
    const handle = await picker({
      suggestedName: file.filename,
      types: [{ description: kind.description, accept: { [kind.mime]: kind.extensions } }],
    })
    const writable = await handle.createWritable()
    await writable.write(file.content)
    await writable.close()
  } catch (err) {
    // The user dismissing the dialog is not an error; surface anything else.
    if ((err as DOMException)?.name !== "AbortError") {
      console.error("Failed to save file:", err)
    }
  }
  return true
}

/** Fallback: an anchor download link (the browser may append `" (1)"` on collisions). */
function saveViaAnchor(file: SavedFile, kind: FileKind): void {
  const url = URL.createObjectURL(new Blob([file.content], { type: kind.mime }))
  const a = document.createElement("a")
  a.href = url
  a.download = file.filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Save a text file, preferring the File System Access API (overwrites in place,
 * avoiding `" (1)"` collision suffixes) and falling back to an anchor download
 * link where it isn't supported.
 */
async function saveTextFile(file: SavedFile, kind: FileKind): Promise<void> {
  if (!(await saveViaPicker(file, kind))) saveViaAnchor(file, kind)
}

/** Trigger a browser download of the selected MIGs as canonical YAML. */
export async function downloadMigs(
  migs: MessageImplementationGuide[],
  pathOrder?: Map<string, number>,
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
  message: MessageDefinition,
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
  message: MessageDefinition,
): Promise<void> {
  await saveTextFile(buildMigCsv(mig, allMigs, message), CSV)
}
