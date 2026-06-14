import { useState } from "react"
import {
  ArrowClockwiseIcon,
  CheckCircleIcon,
  DownloadSimpleIcon,
  TrashIcon,
  WrenchIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { navigate } from "@/app/routes"
import { deleteDatabase } from "@/core/storage/db"
import { loadAllMigs } from "@/core/storage/migStore"
import { downloadMigs } from "@/features/mig/downloadMigs"
import { reloadPage } from "@/lib/reload"

type BackupState = "idle" | "working" | "done" | "empty" | "failed"

/**
 * A "secret" maintenance page (route `#reset`) that wipes all local storage —
 * the e-Repository, every MIG, all revision history, and the trash. It is
 * intentionally **not linked anywhere** in the UI and is reachable only by
 * typing the URL, so a normal user never lands here by accident.
 *
 * Mirrors {@link RecoveryScreen}'s reset, but reached on purpose rather than
 * after a storage fault, so it renders regardless of whether the database
 * opened. Offers a best-effort MIG backup first behind a confirm.
 */
export function ResetScreen() {
  const [backup, setBackup] = useState<BackupState>("idle")
  const [resetOpen, setResetOpen] = useState(false)
  const [done, setDone] = useState(false)

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
      console.error("Backup before reset failed:", err)
      setBackup("failed")
    }
  }

  const reset = async () => {
    try {
      await deleteDatabase()
    } catch (err) {
      console.error("Reset failed:", err)
    }
    setDone(true)
  }

  // Leave the `#reset` page and fully reload so App re-bootstraps from the now-
  // empty database — which lands on the e-Repository upload screen.
  const leaveToHome = () => {
    navigate({ name: "home" })
    reloadPage()
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-4 p-6">
      <h1 className="flex items-center gap-2 text-base font-semibold tracking-tight">
        <WrenchIcon
          className="size-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        Reset local storage
      </h1>
      {done ? (
        <p className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <CheckCircleIcon
            className="size-4 shrink-0 text-foreground"
            aria-hidden
          />
          Local storage cleared.
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={leaveToHome}
          >
            Reload the app
          </Button>
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            This permanently deletes the e-Repository, every MIG, all revision
            history, and the trash from this browser. There is no undo —
            download a backup of your MIGs first if you might need them.
          </p>

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
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ name: "home" })}
            >
              <ArrowClockwiseIcon data-icon="inline-start" aria-hidden />
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setResetOpen(true)}
            >
              <TrashIcon data-icon="inline-start" aria-hidden />
              Reset everything
            </Button>
          </div>

          <p
            className="min-h-4 text-xs text-muted-foreground"
            aria-live="polite"
          >
            {backup === "done" &&
              "Backup downloaded. Keep it safe — re-import it after resetting."}
            {backup === "empty" && "No MIGs to back up."}
            {backup === "failed" &&
              "Couldn’t read your MIGs — the storage may be unreadable."}
          </p>
        </>
      )}

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Delete all stored data?"
        description="This permanently deletes the e-Repository, every MIG, all revision history, and the trash from this browser. Download a backup first if you can."
        confirmLabel="Delete everything"
        destructive
        onConfirm={() => void reset()}
      />
    </div>
  )
}
