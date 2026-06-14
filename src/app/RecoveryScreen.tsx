import { useState } from "react"
import {
  ArrowClockwiseIcon,
  DownloadSimpleIcon,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { deleteDatabase } from "@/core/storage/db"
import { loadAllMigs } from "@/core/storage/migStore"
import { downloadMigs } from "@/features/mig/downloadMigs"
import { reloadPage } from "@/lib/reload"

type BackupState = "idle" | "working" | "done" | "empty" | "failed"

/**
 * Shown when the IndexedDB database can't be opened at boot (corrupt / full /
 * blocked). Offers a best-effort **backup** of any readable MIGs, a **retry**,
 * and a **reset** (delete everything, start fresh) behind a confirm — so a
 * storage fault doesn't trap the user with no escape and no copy of their work.
 */
export function RecoveryScreen({ error }: { error: unknown }) {
  const [backup, setBackup] = useState<BackupState>("idle")
  const [resetOpen, setResetOpen] = useState(false)

  const runBackup = async () => {
    setBackup("working")
    try {
      const migs = await loadAllMigs()
      if (migs.length === 0) {
        setBackup("empty")
        return
      }
      await downloadMigs(migs)
      setBackup("done")
    } catch (err) {
      console.error("Backup during recovery failed:", err)
      setBackup("failed")
    }
  }

  const reset = async () => {
    try {
      await deleteDatabase()
    } catch (err) {
      console.error("Reset during recovery failed:", err)
    }
    reloadPage()
  }

  const message =
    error instanceof Error ? error.message : error ? String(error) : ""

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-4 p-6">
      <h1 className="flex items-center gap-2 text-base font-semibold tracking-tight">
        <WarningIcon className="size-5 shrink-0 text-destructive" aria-hidden />
        Couldn’t open local storage
      </h1>
      <p className="text-sm text-muted-foreground">
        The browser database that holds your e-Repository and MIGs couldn’t be
        opened — it may be corrupted, full, or blocked (e.g. private browsing).
        Try downloading a backup of your MIGs first, then reset to start fresh.
      </p>
      {message && (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs break-words text-muted-foreground">
          {message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void runBackup()}
          disabled={backup === "working"}
        >
          <DownloadSimpleIcon data-icon="inline-start" aria-hidden />
          {backup === "working" ? "Backing up…" : "Download my MIGs"}
        </Button>
        <Button variant="outline" size="sm" onClick={reloadPage}>
          <ArrowClockwiseIcon data-icon="inline-start" aria-hidden />
          Retry
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setResetOpen(true)}
        >
          <TrashIcon data-icon="inline-start" aria-hidden />
          Reset &amp; start fresh
        </Button>
      </div>

      <p className="min-h-4 text-xs text-muted-foreground" aria-live="polite">
        {backup === "done" &&
          "Backup downloaded. Keep it safe — re-import it after resetting."}
        {backup === "empty" && "No MIGs could be read to back up."}
        {backup === "failed" &&
          "Couldn’t read your MIGs — the storage may be unreadable."}
      </p>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Delete all stored data?"
        description="This permanently deletes the e-Repository, every MIG, all revision history, and the trash from this browser, then reloads. Download a backup first if you can."
        confirmLabel="Delete everything"
        destructive
        onConfirm={() => void reset()}
      />
    </div>
  )
}
