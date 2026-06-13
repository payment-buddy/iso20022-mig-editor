import { useState, type ReactNode } from "react"
import { CaretRight, Check, Plus } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { CreateMigDialog } from "@/features/mig/CreateMigDialog"
import { resolveMessage, type ResolvedMessage } from "@/core/erepository/resolveMessage"
import type { Constraint, ERepository, MessageElement } from "@/core/types/types"
import { hashFor } from "@/app/routes"
import { cn } from "@/lib/utils"

type Selection =
  | { kind: "element"; element: MessageElement; path: string }
  | { kind: "constraint"; constraint: Constraint; path: string }

/** Read-only message explorer (FUNCTIONALITY §5.4, bare minimum) with a detail panel. */
export function MessageExplorer({ repo, code }: { repo: ERepository; code: string }) {
  const resolved = resolveMessage(repo, code)

  if (!resolved) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-2 p-6">
        <h1 className="text-base font-semibold tracking-tight">Message not found</h1>
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

  // Keyed by identifier so navigating to another message/version resets selection.
  return <MessageView key={resolved.current.identifier} resolved={resolved} />
}

function MessageView({ resolved }: { resolved: ResolvedMessage }) {
  const { area, current, versions } = resolved
  const root = current.rootElement
  const [picked, setPicked] = useState<Selection | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const selected: Selection = picked ?? { kind: "element", element: root, path: root.xmlTag }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{area.name}</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight">{current.name}</h1>
            <code className="rounded-sm bg-muted px-1 text-[0.625rem] text-muted-foreground">
              {current.identifier}
            </code>
          </div>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus data-icon="inline-start" aria-hidden />
          Create MIG
        </Button>
      </div>

      <CreateMigDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        messageIdentifier={current.identifier}
      />

      {versions.length > 1 && (
        <div className="flex flex-wrap items-center gap-1" aria-label="Versions">
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
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {v.identifier.split(".").pop()}
              </a>
            )
          })}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[1fr_20rem]">
        <ul className="flex flex-col text-sm">
          <ElementNode
            element={root}
            level={0}
            path={root.xmlTag}
            selectedPath={selected.path}
            onSelect={setPicked}
          />
        </ul>
        {selected.kind === "element" ? (
          <ElementDetail element={selected.element} path={selected.path} />
        ) : (
          <ConstraintDetail constraint={selected.constraint} path={selected.path} />
        )}
      </div>
    </div>
  )
}

function cardinality(e: MessageElement): string {
  return `[${e.minOccurs}..${e.maxOccurs ?? "*"}]`
}

function ElementNode({
  element,
  level,
  path,
  selectedPath,
  onSelect,
}: {
  element: MessageElement
  level: number
  path: string
  selectedPath: string | null
  onSelect: (sel: Selection) => void
}) {
  const hasChildren = element.elements.length > 0 || element.constraints.length > 0
  const [open, setOpen] = useState(level === 0)
  const isSelected = path === selectedPath

  return (
    <li>
      <div className="flex items-center gap-1" style={{ paddingLeft: level === 0 ? 0 : level * 16 }}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} ${element.name}`}
            className="rounded-sm p-0.5 text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <CaretRight className={cn("size-3.5", open && "rotate-90")} aria-hidden />
          </button>
        ) : (
          <span className="inline-block size-4 shrink-0" aria-hidden />
        )}
        <button
          type="button"
          onClick={() => onSelect({ kind: "element", element, path })}
          aria-label={element.name}
          aria-current={isSelected ? "true" : undefined}
          className={cn(
            "flex flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30",
            isSelected && "bg-muted",
          )}
        >
          <span className="font-medium">{element.name}</span>
          <code className="text-[0.625rem] text-muted-foreground">{element.xmlTag}</code>
          <span className="text-xs text-muted-foreground">{cardinality(element)}</span>
          {element.isChoice && (
            <span className="rounded-sm bg-muted px-1 text-[0.625rem] text-muted-foreground">
              choice
            </span>
          )}
          {element.type && (
            <span className="ml-auto text-xs text-muted-foreground">{element.type}</span>
          )}
        </button>
      </div>
      {hasChildren && open && (
        <ul className="flex flex-col">
          {element.elements.map((child) => (
            <ElementNode
              key={child.id}
              element={child}
              level={level + 1}
              path={`${path}/${child.xmlTag}`}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
          {element.constraints.map((constraint) => (
            <ConstraintNode
              key={constraint.name}
              constraint={constraint}
              level={level + 1}
              path={`${path}/${constraint.name}`}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function ConstraintNode({
  constraint,
  level,
  path,
  selectedPath,
  onSelect,
}: {
  constraint: Constraint
  level: number
  path: string
  selectedPath: string | null
  onSelect: (sel: Selection) => void
}) {
  const isSelected = path === selectedPath
  return (
    <li>
      <div className="flex items-center gap-1" style={{ paddingLeft: level * 16 }}>
        <span className="inline-block size-4 shrink-0" aria-hidden />
        <button
          type="button"
          onClick={() => onSelect({ kind: "constraint", constraint, path })}
          aria-label={`Constraint ${constraint.name}`}
          aria-current={isSelected ? "true" : undefined}
          className={cn(
            "flex flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30",
            isSelected && "bg-muted",
          )}
        >
          <Check className="size-3 shrink-0 text-muted-foreground" aria-hidden />
          <span>{constraint.name}</span>
        </button>
      </div>
    </li>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[0.625rem] tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="text-sm break-words">{children}</div>
    </div>
  )
}

function DetailPanel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="region"
      aria-label={label}
      className="flex h-fit flex-col gap-3 rounded-lg border border-border p-3 md:sticky md:top-24"
    >
      {children}
    </div>
  )
}

function ConstraintDetail({ constraint, path }: { constraint: Constraint; path: string }) {
  return (
    <DetailPanel label="Constraint details">
      <div className="flex items-center gap-1.5 font-medium">
        <Check className="size-3.5 text-muted-foreground" aria-hidden />
        {constraint.name}
      </div>
      <Field label="Kind">Constraint (rule)</Field>
      <Field label="Path">
        <code className="text-xs">{path}</code>
      </Field>
      {constraint.definition && (
        <Field label="Definition">
          <span className="whitespace-pre-wrap text-muted-foreground">{constraint.definition}</span>
        </Field>
      )}
    </DetailPanel>
  )
}

function ElementDetail({ element, path }: { element: MessageElement; path: string }) {
  const e = element
  const range = (lo: number | null, hi: number | null) =>
    lo != null || hi != null ? `${lo ?? "*"} … ${hi ?? "*"}` : null
  const length = range(e.minLength, e.maxLength) ?? (e.length != null ? String(e.length) : null)
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
        {e.baseType && <span className="text-muted-foreground"> ({e.baseType})</span>}
      </Field>
      <Field label="Multiplicity">
        [{e.minOccurs}..{e.maxOccurs ?? "unbounded"}]
      </Field>
      {e.definition && (
        <Field label="Definition">
          <span className="whitespace-pre-wrap text-muted-foreground">{e.definition}</span>
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
      {e.examples.length > 0 && <Field label="Examples">{e.examples.join(", ")}</Field>}
    </DetailPanel>
  )
}
