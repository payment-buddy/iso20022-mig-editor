// Browser file-saving, shared by the MIG and message-definition exporters.
// Prefers the File System Access API (the user picks the location and an existing
// file is overwritten in place — no `" (1)"` suffix) and falls back to an anchor
// download link where it isn't supported.

export type SavedFile = { filename: string; content: string }
export type FileKind = {
  mime: string
  description: string
  extensions: string[]
}

export const YAML: FileKind = {
  mime: "text/yaml",
  description: "YAML",
  extensions: [".yaml", ".yml"],
}
export const MARKDOWN: FileKind = {
  mime: "text/markdown",
  description: "Markdown",
  extensions: [".md"],
}
export const CSV: FileKind = {
  mime: "text/csv",
  description: "CSV",
  extensions: [".csv"],
}

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
async function saveViaPicker(
  file: SavedFile,
  kind: FileKind
): Promise<boolean> {
  const picker = (
    window as unknown as { showSaveFilePicker?: ShowSaveFilePicker }
  ).showSaveFilePicker
  if (!picker) return false
  try {
    const handle = await picker({
      suggestedName: file.filename,
      types: [
        {
          description: kind.description,
          accept: { [kind.mime]: kind.extensions },
        },
      ],
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
export async function saveTextFile(
  file: SavedFile,
  kind: FileKind
): Promise<void> {
  if (!(await saveViaPicker(file, kind))) saveViaAnchor(file, kind)
}
