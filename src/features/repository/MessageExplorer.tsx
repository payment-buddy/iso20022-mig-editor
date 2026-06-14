import { useState } from "react"
import { CheckIcon, ExportIcon, PlusIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { CreateMigDialog } from "@/features/mig/CreateMigDialog"
import {
  resolveMessage,
  type ResolvedMessage,
} from "@/core/erepository/resolveMessage"
import type {
  Constraint,
  ERepository,
  MessageElement,
} from "@/core/types/types"
import { hashFor } from "@/app/routes"
import { cn } from "@/lib/utils"
import { downloadMessageYaml } from "./downloadMessage"
import { DetailPanel, ElementTree, Field } from "./ElementTree"

/** Read-only message explorer (bare minimum) with a detail panel. */
export function MessageExplorer({
  repo,
  code,
}: {
  repo: ERepository
  code: string
}) {
  const resolved = resolveMessage(repo, code)

  if (!resolved) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-2 p-6 xl:max-w-4xl">
        <h1 className="text-base font-semibold tracking-tight">
          Message not found
        </h1>
        <p className="text-sm text-muted-foreground">
          No message matches “{code}”. Try the{" "}
          <a
            href={hashFor({ name: "browse" })}
            className="text-primary underline-offset-4 hover:underline"
          >
            e-Repository browser
          </a>
          .
        </p>
      </div>
    )
  }

  // Keyed by identifier so navigating to another message/version resets the tree.
  return <MessageView key={resolved.current.identifier} resolved={resolved} />
}

function MessageView({ resolved }: { resolved: ResolvedMessage }) {
  const { area, current, versions } = resolved
  const root = current.rootElement
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6 xl:max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-[0.625rem] font-medium tracking-wide text-muted-foreground uppercase">
            Message Definition
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight">
              {current.name}
            </h1>
            <code className="rounded-sm bg-muted px-1 text-[0.625rem] text-muted-foreground">
              {current.identifier}
            </code>
          </div>
          <p className="text-xs text-muted-foreground">{area.name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void downloadMessageYaml(current)}
          >
            <ExportIcon data-icon="inline-start" aria-hidden />
            Export YAML
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon="inline-start" aria-hidden />
            Create MIG
          </Button>
        </div>
      </div>

      <CreateMigDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        messageIdentifier={current.identifier}
        shortCode={current.shortCode}
      />

      {versions.length > 1 && (
        <div
          className="flex flex-wrap items-center gap-1"
          aria-label="Versions"
        >
          {versions.map((v) => {
            const isCurrent = v.identifier === current.identifier
            return (
              <a
                key={v.identifier}
                href={hashFor({ name: "message", code: v.identifier })}
                aria-current={isCurrent ? "page" : undefined}
                title={v.identifier}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-xs no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                  isCurrent
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {v.identifier.split(".").pop()}
              </a>
            )
          })}
        </div>
      )}

      <ElementTree
        root={root}
        ariaLabel={`${current.name} structure`}
        renderDetail={(sel) =>
          sel?.kind === "constraint" ? (
            <ConstraintDetail constraint={sel.constraint} path={sel.path} />
          ) : sel ? (
            <ElementDetail element={sel.element} path={sel.path} />
          ) : null
        }
      />
    </div>
  )
}

function ConstraintDetail({
  constraint,
  path,
}: {
  constraint: Constraint
  path: string
}) {
  return (
    <DetailPanel label="Constraint details">
      <div className="flex items-center gap-1.5 font-medium">
        <CheckIcon className="size-3.5 text-muted-foreground" aria-hidden />
        {constraint.name}
      </div>
      <Field label="Kind">Constraint (rule)</Field>
      <Field label="XML path">
        <code className="text-xs">{path.slice(0, path.lastIndexOf("/"))}</code>
      </Field>
      {constraint.definition && (
        <Field label="Definition">
          <span className="whitespace-pre-wrap">{constraint.definition}</span>
        </Field>
      )}
    </DetailPanel>
  )
}

function ElementDetail({
  element,
  path,
}: {
  element: MessageElement
  path: string
}) {
  const e = element
  const range = (lo: number | null, hi: number | null) =>
    lo != null || hi != null ? `${lo ?? "*"} … ${hi ?? "*"}` : null
  const length =
    range(e.minLength, e.maxLength) ??
    (e.length != null ? String(e.length) : null)
  const inclusive = range(e.minInclusive, e.maxInclusive)
  const digits =
    e.totalDigits != null || e.fractionDigits != null
      ? `${e.totalDigits ?? "—"} total, ${e.fractionDigits ?? "—"} fraction`
      : null

  return (
    <DetailPanel label="Element details">
      <div className="font-medium">{e.name}</div>
      <Field label={e.isAttribute ? "XML attribute" : "XML tag"}>
        <code className="text-xs">{e.xmlTag}</code>
      </Field>
      <Field label="XML path">
        <code className="text-xs">{path}</code>
      </Field>
      <Field label="Type">
        {e.type}
        {e.baseType && (
          <span className="text-muted-foreground"> ({e.baseType})</span>
        )}
      </Field>
      <Field label="Multiplicity">
        [{e.minOccurs}..{e.maxOccurs ?? "unbounded"}]
      </Field>
      {e.definition && (
        <Field label="Definition">
          <span className="whitespace-pre-wrap">{e.definition}</span>
        </Field>
      )}
      {length && <Field label="Length">{length}</Field>}
      {inclusive && <Field label="Inclusive range">{inclusive}</Field>}
      {digits && <Field label="Digits">{digits}</Field>}
      {e.pattern && (
        <Field label="Pattern">
          <code className="text-xs break-all">{e.pattern}</code>
        </Field>
      )}
      {e.codes.length > 0 && (
        <Field label={`Allowed values (${e.codes.length})`}>
          <div className="flex flex-wrap gap-1">
            {e.codes.map((c) => (
              <code
                key={c.codeName}
                title={c.definition}
                className="rounded-sm bg-muted px-1 text-[0.625rem]"
              >
                {c.codeName}
              </code>
            ))}
          </div>
        </Field>
      )}
      {e.examples.length > 0 && (
        <Field label="Examples">{e.examples.join(", ")}</Field>
      )}
    </DetailPanel>
  )
}
