import { AlertDialog } from "radix-ui"
import type { DuplicateResolution } from "@/core/mig/importDuplicates"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Resolution prompt for a MIG import that collides with existing MIGs
 * (FUNCTIONALITY §5.2). Lists the duplicates and offers Skip / Upload as new /
 * Overwrite; Esc or Cancel aborts the whole import. `duplicates` are display
 * labels (e.g. "EPC 1.0").
 */
export function ImportDuplicateDialog({
  open,
  onOpenChange,
  duplicates,
  onResolve,
  onMerge,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  duplicates: string[]
  onResolve: (resolution: DuplicateResolution) => void
  /** Provided only when a single same-family duplicate can be merged. */
  onMerge?: () => void
}) {
  const n = duplicates.length
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-4 shadow-lg outline-none">
          <AlertDialog.Title className="text-sm font-semibold">
            {n === 1 ? "A MIG already exists" : `${n} MIGs already exist`}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-1 text-sm text-muted-foreground">
            {n === 1 ? "This MIG is already stored:" : "These MIGs are already stored:"}
          </AlertDialog.Description>
          <ul className="mt-2 max-h-40 list-disc overflow-auto pl-5 text-sm">
            {duplicates.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted-foreground">
            {onMerge ? "Skip, merge changes, upload as a new version, or overwrite?" : null}
            {!onMerge ? "Skip them, upload as a new version, or overwrite the stored ones?" : null}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <AlertDialog.Cancel className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Cancel
            </AlertDialog.Cancel>
            <AlertDialog.Action
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              onClick={() => onResolve("skip")}
            >
              Skip
            </AlertDialog.Action>
            {onMerge && (
              <AlertDialog.Action
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                onClick={onMerge}
              >
                Merge…
              </AlertDialog.Action>
            )}
            <AlertDialog.Action
              className={cn(buttonVariants({ variant: "default", size: "sm" }))}
              onClick={() => onResolve("new")}
            >
              Upload as new
            </AlertDialog.Action>
            <AlertDialog.Action
              className={cn(buttonVariants({ variant: "destructive", size: "sm" }))}
              onClick={() => onResolve("overwrite")}
            >
              Overwrite
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
