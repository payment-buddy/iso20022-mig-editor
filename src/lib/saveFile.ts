// Browser file-saving, shared by the MIG and message-definition exporters.
//
// Uses a classic anchor-download link so saves go through the browser's download
// manager — they appear in the download history with a working "Show in folder",
// so the user can always locate the file. (We deliberately do *not* use the File
// System Access API: it writes directly to a picked location and never shows up
// in download history, and the browser sandbox never exposes the path to JS. The
// trade-off is that re-saving the same name yields a `" (1)"` suffix.)

export type SavedFile = { filename: string; content: string | Uint8Array }
export type FileKind = { mime: string }

export const YAML: FileKind = { mime: "text/yaml" }
export const MARKDOWN: FileKind = { mime: "text/markdown" }
export const XLSX: FileKind = {
  mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

/**
 * Save a file via an anchor download link. It lands in the browser's Downloads
 * folder and appears in the download history (the browser appends `" (1)"` on a
 * name collision).
 */
export function saveTextFile(file: SavedFile, kind: FileKind): void {
  // `content` is a string or fflate `Uint8Array`; both are valid Blob parts (the
  // cast only sidesteps the over-narrow `ArrayBufferLike` vs `ArrayBuffer` lib type).
  const url = URL.createObjectURL(
    new Blob([file.content as BlobPart], { type: kind.mime })
  )
  const a = document.createElement("a")
  a.href = url
  a.download = file.filename
  a.click()
  URL.revokeObjectURL(url)
}
