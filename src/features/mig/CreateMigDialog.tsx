import { useId, useState, type FormEvent } from "react"
import { Dialog } from "radix-ui"
import { Button, buttonVariants } from "@/components/ui/button"
import { getMigKey } from "@/core/mig/migKey"
import { loadAllMigs, saveMig } from "@/core/storage/migStore"
import { navigate } from "@/app/routes"
import { cn } from "@/lib/utils"

const inputClass =
  "h-8 rounded-md border border-border bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"

/**
 * Create an empty MIG for a message. Defaults Name to `MIG-<shortCode>` (e.g.
 * `MIG-pacs.008`) and Version to `1.0-DRAFT`; on save persists (storing the exact
 * `messageIdentifier`) and navigates to the new MIG's editor.
 */
export function CreateMigDialog({
  open,
  onOpenChange,
  messageIdentifier,
  shortCode,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  messageIdentifier: string
  /** Message family code (e.g. `pacs.008`) used for the default MIG name. */
  shortCode: string
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-4 shadow-lg outline-none">
          <Dialog.Title className="text-sm font-semibold">
            New Message Implementation Guide
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            For <code>{messageIdentifier}</code>
          </Dialog.Description>
          {/* Content unmounts on close, so the form seeds fresh defaults each open. */}
          <CreateMigForm
            messageIdentifier={messageIdentifier}
            shortCode={shortCode}
            onClose={() => onOpenChange(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function CreateMigForm({
  messageIdentifier,
  shortCode,
  onClose,
}: {
  messageIdentifier: string
  shortCode: string
  onClose: () => void
}) {
  const [name, setName] = useState(`MIG-${shortCode}`)
  const [version, setVersion] = useState("1.0-DRAFT")
  const [error, setError] = useState<string | null>(null)
  const nameId = useId()
  const versionId = useId()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedVersion = version.trim()
    if (!trimmedName || !trimmedVersion) {
      setError("Name and version are both required.")
      return
    }
    const key = getMigKey({ name: trimmedName, version: trimmedVersion })
    const existing = await loadAllMigs()
    if (existing.some((m) => getMigKey(m) === key)) {
      setError(`A MIG "${key}" already exists.`)
      return
    }
    await saveMig({
      name: trimmedName,
      messageIdentifier,
      version: trimmedVersion,
      elementOverrides: {},
    })
    onClose()
    navigate({ name: "mig", key })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={nameId} className="text-xs font-medium">
          Name
        </label>
        <input
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={versionId} className="text-xs font-medium">
          Version
        </label>
        <input
          id={versionId}
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          className={inputClass}
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="mt-2 flex items-center justify-end gap-2">
        <Dialog.Close
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Cancel
        </Dialog.Close>
        <Button type="submit" size="sm">
          Create
        </Button>
      </div>
    </form>
  )
}
