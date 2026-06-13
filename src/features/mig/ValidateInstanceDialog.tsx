import { useState } from "react"
import { Dialog } from "radix-ui"
import { CheckCircle, Warning } from "@phosphor-icons/react"
import { validateMessageInstance, type InstanceDiagnostic } from "@/core/mig/validateInstance"
import type { ElementOverrides, MessageDefinition } from "@/core/types/types"
import { Button } from "@/components/ui/button"
import { parseMessageXml } from "./parseMessageXml"

type Result = { kind: "error"; error: string } | { kind: "ok"; diagnostics: InstanceDiagnostic[] }

/**
 * Validate a message-instance XML against the resolved message + the effective
 * MIG (IMPLEMENTATION_PLAN Phase 6): paste or upload an XML, see the violations
 * (cardinality / exclusion / codes / lengths / patterns / ranges), and click one
 * to jump to its element in the tree via `onNavigate`.
 */
export function ValidateInstanceDialog({
  open,
  onOpenChange,
  message,
  effectiveOverrides,
  onNavigate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: MessageDefinition
  effectiveOverrides: ElementOverrides
  onNavigate: (path: string) => void
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-background p-4 shadow-lg outline-none">
          <Dialog.Title className="text-sm font-semibold">Validate a message instance</Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            Check an XML message against <code>{message.identifier}</code> and this MIG.
          </Dialog.Description>
          {/* Content unmounts on close, so each open starts fresh. */}
          <ValidateForm
            message={message}
            effectiveOverrides={effectiveOverrides}
            onNavigate={(path) => {
              onOpenChange(false)
              onNavigate(path)
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ValidateForm({
  message,
  effectiveOverrides,
  onNavigate,
}: {
  message: MessageDefinition
  effectiveOverrides: ElementOverrides
  onNavigate: (path: string) => void
}) {
  const [xml, setXml] = useState("")
  const [result, setResult] = useState<Result | null>(null)

  const validate = () => {
    const parsed = parseMessageXml(xml)
    setResult(
      "error" in parsed
        ? { kind: "error", error: parsed.error }
        : { kind: "ok", diagnostics: validateMessageInstance(parsed.root, message, effectiveOverrides) },
    )
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setXml(await file.text())
      setResult(null)
    }
  }

  return (
    <div className="mt-3 flex min-h-0 flex-col gap-3">
      <textarea
        value={xml}
        onChange={(e) => {
          setXml(e.target.value)
          setResult(null)
        }}
        aria-label="Message XML"
        placeholder="Paste the message XML here…"
        rows={8}
        className="resize-y rounded-md border border-border bg-transparent p-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept=".xml,text/xml,application/xml"
          onChange={onFile}
          aria-label="Upload message XML"
          className="text-xs text-muted-foreground file:mr-2 file:rounded-md file:border file:border-border file:bg-transparent file:px-2 file:py-1 file:text-foreground hover:file:bg-muted"
        />
        <Button type="button" size="sm" className="ml-auto" disabled={!xml.trim()} onClick={validate}>
          Validate
        </Button>
      </div>
      {result && (
        <div className="min-h-0 overflow-auto">
          <Results result={result} onNavigate={onNavigate} />
        </div>
      )}
    </div>
  )
}

function Results({ result, onNavigate }: { result: Result; onNavigate: (path: string) => void }) {
  if (result.kind === "error") {
    return (
      <p role="alert" className="text-sm text-destructive">
        {result.error}
      </p>
    )
  }
  if (result.diagnostics.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-500">
        <CheckCircle className="size-4 shrink-0" aria-hidden />
        No violations — the instance conforms to this MIG.
      </p>
    )
  }
  const n = result.diagnostics.length
  return (
    <section
      aria-label="Validation results"
      className="rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-500"
    >
      <p className="flex items-center gap-2 px-3 py-2 text-sm font-medium">
        <Warning className="size-4 shrink-0" aria-hidden />
        {n} {n === 1 ? "violation" : "violations"}
      </p>
      <ul aria-label="Violations" className="flex flex-col border-t border-amber-500/30 py-1">
        {result.diagnostics.map((d, i) => (
          <li key={`${d.path}-${i}`}>
            <button
              type="button"
              onClick={() => onNavigate(d.path)}
              title={`Go to ${d.path}`}
              className="w-full rounded-sm px-3 py-1 text-left text-xs outline-none hover:bg-amber-500/15 focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <span className="font-medium">{d.elementName}</span>
              <span className="block text-amber-700/90 dark:text-amber-500/90">{d.message}</span>
              <code className="text-[0.625rem] text-amber-700/60 dark:text-amber-500/60">{d.path}</code>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
