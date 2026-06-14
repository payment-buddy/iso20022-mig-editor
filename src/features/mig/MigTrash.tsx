import { useCallback, useEffect, useState } from "react"
import { ArrowCounterClockwiseIcon, TrashIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { getMigKey } from "@/core/mig/migKey"
import {
  emptyTrash,
  loadTrash,
  purgeFromTrash,
  restoreFromTrash,
  type TrashedMig,
} from "@/core/storage/trashStore"
import { hashFor } from "@/app/routes"
import { formatLocalDateTime } from "@/lib/datetime"

/** A pending permanent-deletion confirmation: one MIG, or the whole trash. */
type Confirm = { kind: "purge"; key: string; label: string } | { kind: "empty" }

/**
 * The Trash (`#trash`): MIGs deleted from the home list land here (with their
 * revision history) until restored or permanently deleted. Retention is manual —
 * nothing is auto-purged.
 */
export function MigTrash() {
  const [items, setItems] = useState<TrashedMig[]>([])
  const [status, setStatus] = useState<"loading" | "ready">("loading")
  const [confirm, setConfirm] = useState<Confirm | null>(null)

  const refresh = useCallback(() => {
    loadTrash()
      .then((t) => {
        setItems(t)
        setStatus("ready")
      })
      .catch((err) => {
        console.error("Failed to load trash:", err)
        setStatus("ready")
      })
  }, [])

  useEffect(refresh, [refresh])

  const restore = async (key: string) => {
    await restoreFromTrash(key)
    refresh()
  }

  const runConfirm = async () => {
    if (!confirm) return
    if (confirm.kind === "purge") await purgeFromTrash(confirm.key)
    else await emptyTrash()
    setConfirm(null)
    refresh()
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6 xl:max-w-4xl">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-base font-semibold tracking-tight">Trash</h1>
        {items.length > 0 && (
          <Button variant="destructive" size="sm" onClick={() => setConfirm({ kind: "empty" })}>
            <TrashIcon data-icon="inline-start" aria-hidden />
            Empty trash
          </Button>
        )}
      </div>

      {status === "ready" && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Trash is empty. MIGs you delete from the{" "}
          <a
            href={hashFor({ name: "home" })}
            className="text-primary underline-offset-4 hover:underline"
          >
            home list
          </a>{" "}
          land here, where you can restore or permanently delete them.
        </p>
      ) : items.length > 0 ? (
        <table className="w-full border-separate border-spacing-0 text-sm" aria-label="Trashed MIGs">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="border-b border-border px-2 py-1.5 font-medium">Name</th>
              <th scope="col" className="border-b border-border px-2 py-1.5 font-medium">Version</th>
              <th scope="col" className="border-b border-border px-2 py-1.5 font-medium">Message</th>
              <th scope="col" className="border-b border-border px-2 py-1.5 font-medium">Deleted</th>
              <th scope="col" className="border-b border-border px-2 py-1.5 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ mig, deletedAt }) => {
              const key = getMigKey(mig)
              return (
                <tr key={key} className="hover:bg-muted">
                  <td className="border-b border-border px-2 py-1.5 font-medium">{mig.name}</td>
                  <td className="border-b border-border px-2 py-1.5">{mig.version}</td>
                  <td className="border-b border-border px-2 py-1.5 text-muted-foreground">
                    {mig.messageIdentifier}
                  </td>
                  <td className="border-b border-border px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                    {formatLocalDateTime(deletedAt)}
                  </td>
                  <td className="border-b border-border px-2 py-1.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="outline" size="sm" onClick={() => void restore(key)}>
                        <ArrowCounterClockwiseIcon data-icon="inline-start" aria-hidden />
                        Restore
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete ${mig.name} ${mig.version} permanently`}
                        onClick={() => setConfirm({ kind: "purge", key, label: `${mig.name} ${mig.version}` })}
                      >
                        <TrashIcon aria-hidden />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : null}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm?.kind === "empty"
            ? `Empty the trash (${items.length})?`
            : "Delete this MIG permanently?"
        }
        description={
          confirm?.kind === "empty"
            ? "This permanently deletes every MIG in the trash. This cannot be undone."
            : `“${confirm?.kind === "purge" ? confirm.label : ""}” will be permanently deleted. This cannot be undone.`
        }
        confirmLabel="Delete permanently"
        destructive
        onConfirm={() => void runConfirm()}
      />
    </div>
  )
}
