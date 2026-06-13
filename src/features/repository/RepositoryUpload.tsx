import { useCallback, useRef, useState } from "react"
import { SpinnerGap, UploadSimple, Warning } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { parseRepository } from "@/core/erepository/eRepository"
import { saveERepository } from "@/core/storage/eRepositoryStore"
import type { ERepository } from "@/core/types/types"
import { cn } from "@/lib/utils"

type Status = "idle" | "parsing" | "error"

const ACCEPT = ".iso20022,.zip"
const ISO_SOURCE_URL = "https://www.iso20022.org/iso20022-repository/e-repository"

function hasValidExtension(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith(".iso20022") || lower.endsWith(".zip")
}

export function RepositoryUpload({
  onLoaded,
  onCancel,
}: {
  /** Called after the file is parsed and persisted. */
  onLoaded: (repo: ERepository) => void
  /** When provided, renders a "Cancel" affordance (used in re-upload mode). */
  onCancel?: () => void
}) {
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setFileName(file.name)
      if (!hasValidExtension(file.name)) {
        setStatus("error")
        setError(`"${file.name}" is not a .iso20022 or .zip file.`)
        return
      }
      setStatus("parsing")
      setError(null)
      try {
        const repo = await parseRepository(file)
        await saveERepository(repo)
        onLoaded(repo)
      } catch (err) {
        console.error("Failed to load e-Repository:", err)
        setStatus("error")
        setError(
          err instanceof Error
            ? `Could not parse the file: ${err.message}`
            : "Could not parse the file.",
        )
      }
    },
    [onLoaded],
  )

  const openPicker = () => inputRef.current?.click()

  const parsing = status === "parsing"

  return (
    <div className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 p-6">
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold tracking-tight">ISO 20022 MIG Editor</h1>
        <p className="text-sm text-muted-foreground">
          Load an{" "}
          <a
            href={ISO_SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            ISO 20022 e-Repository
          </a>{" "}
          file (<code className="text-xs">.iso20022</code> or{" "}
          <code className="text-xs">.zip</code>) to get started.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!parsing) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (parsing) return
          const file = e.dataTransfer.files?.[0]
          if (file) void handleFile(file)
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center transition-colors",
          dragging ? "border-ring bg-input/50" : "border-border",
          parsing && "opacity-70",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          aria-label="e-Repository file"
          className="sr-only"
          disabled={parsing}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
            // allow re-selecting the same file after an error
            e.target.value = ""
          }}
        />

        {parsing ? (
          <>
            <SpinnerGap className="size-6 animate-spin text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground" role="status">
              Parsing {fileName ? <span className="font-medium">{fileName}</span> : "file"}…
            </p>
            <p className="text-xs text-muted-foreground">
              Large repositories can take a few seconds.
            </p>
          </>
        ) : (
          <>
            <UploadSimple className="size-6 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Drag a file here, or
            </p>
            <Button size="lg" onClick={openPicker}>
              <UploadSimple data-icon="inline-start" aria-hidden />
              Choose file
            </Button>
          </>
        )}
      </div>

      {status === "error" && error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <Warning className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        The file is stored locally in your browser (IndexedDB) and persists across sessions. It is
        never uploaded anywhere. Export your MIGs as YAML regularly — clearing browser data deletes
        them.
      </p>

      {onCancel && !parsing && (
        <div>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
