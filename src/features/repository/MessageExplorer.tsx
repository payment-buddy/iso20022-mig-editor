import { useState } from "react"
import { CaretRight } from "@phosphor-icons/react"
import { resolveMessage } from "@/core/erepository/resolveMessage"
import type { ERepository, MessageElement } from "@/core/types/types"
import { hashFor } from "@/app/routes"
import { cn } from "@/lib/utils"

/** Read-only message explorer (FUNCTIONALITY §5.4, bare minimum). */
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

  const { area, current, versions } = resolved

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{area.name}</p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-base font-semibold tracking-tight">{current.name}</h1>
          <code className="rounded-sm bg-muted px-1 text-[0.625rem] text-muted-foreground">
            {current.identifier}
          </code>
        </div>
      </div>

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

      {current.rootElement.definition && (
        <p className="text-sm text-muted-foreground">{current.rootElement.definition}</p>
      )}

      <ul className="flex flex-col text-sm">
        <ElementNode element={current.rootElement} level={0} />
      </ul>
    </div>
  )
}

function cardinality(e: MessageElement): string {
  return `[${e.minOccurs}..${e.maxOccurs ?? "*"}]`
}

function ElementNode({ element, level }: { element: MessageElement; level: number }) {
  const hasChildren = element.elements.length > 0
  const [open, setOpen] = useState(level === 0)

  const label = (
    <>
      {hasChildren ? (
        <CaretRight
          className={cn("size-3.5 shrink-0 text-muted-foreground", open && "rotate-90")}
          aria-hidden
        />
      ) : (
        <span className="inline-block size-3.5 shrink-0" aria-hidden />
      )}
      <span className="font-medium">{element.name}</span>
      <code className="text-[0.625rem] text-muted-foreground">{element.xmlTag}</code>
      <span className="text-xs text-muted-foreground">{cardinality(element)}</span>
      {element.isChoice && (
        <span className="rounded-sm bg-muted px-1 text-[0.625rem] text-muted-foreground">
          choice
        </span>
      )}
      {element.type && <span className="ml-auto text-xs text-muted-foreground">{element.type}</span>}
    </>
  )

  return (
    <li style={{ paddingLeft: level === 0 ? 0 : 16 }}>
      {hasChildren ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          {label}
        </button>
      ) : (
        <div className="flex items-center gap-1.5 px-1.5 py-1" title={element.definition}>
          {label}
        </div>
      )}
      {hasChildren && open && (
        <ul className="flex flex-col">
          {element.elements.map((child) => (
            <ElementNode key={child.id} element={child} level={level + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}
