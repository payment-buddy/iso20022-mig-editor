import { DropdownMenu } from "radix-ui"
import { CaretDown, Export, FileText, Table } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"

const ITEM =
  "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted"

/** Header "Export" menu grouping the secondary report exports (Markdown, CSV). */
export function ExportMenu({ onMarkdown, onCsv }: { onMarkdown: () => void; onCsv: () => void }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" size="sm">
          <Export data-icon="inline-start" aria-hidden />
          Export
          <CaretDown className="ml-1 size-3.5 opacity-60" aria-hidden />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-36 rounded-md border border-border bg-background p-1 shadow-lg outline-none"
        >
          <DropdownMenu.Item className={ITEM} onSelect={onMarkdown}>
            <FileText className="size-4" aria-hidden />
            Markdown
          </DropdownMenu.Item>
          <DropdownMenu.Item className={ITEM} onSelect={onCsv}>
            <Table className="size-4" aria-hidden />
            CSV
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
