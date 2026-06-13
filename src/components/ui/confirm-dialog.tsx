import type { ReactNode } from "react"
import { AlertDialog } from "radix-ui"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Accessible confirm/cancel dialog (Radix AlertDialog: focus trap, Esc, roles). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-4 shadow-lg outline-none">
          <AlertDialog.Title className="text-sm font-semibold">{title}</AlertDialog.Title>
          {description && (
            <AlertDialog.Description className="mt-1 text-sm text-muted-foreground">
              {description}
            </AlertDialog.Description>
          )}
          <div className="mt-4 flex items-center justify-end gap-2">
            <AlertDialog.Cancel className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              {cancelLabel}
            </AlertDialog.Cancel>
            <AlertDialog.Action
              className={cn(
                buttonVariants({ variant: destructive ? "destructive" : "default", size: "sm" }),
              )}
              onClick={onConfirm}
            >
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
