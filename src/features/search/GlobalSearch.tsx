import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react"
import { Dialog } from "radix-ui"
import { MagnifyingGlassIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { navigate } from "@/app/routes"
import { loadAllMigs } from "@/core/storage/migStore"
import {
  isMessageIndexReady,
  prewarmMessageIndex,
  searchMessages,
} from "@/core/search/searchMessages"
import { searchMigs } from "@/core/search/searchMigs"
import {
  fieldLabel,
  hitTargetPath,
  MIN_QUERY,
  type MessageHit,
  type MigHit,
  type SearchScope,
} from "@/core/search/search"
import type { Snippet } from "@/core/search/snippet"
import type {
  ERepository,
  MessageImplementationGuide,
} from "@/core/types/types"

/** How many of the (already-capped) hits to render. */
const SHOWN = 50

const LISTBOX_ID = "global-search-results"
const rowId = (i: number) => `global-search-row-${i}`

const SCOPES: { value: SearchScope; label: string }[] = [
  { value: "migs", label: "MIGs" },
  { value: "messages", label: "Messages" },
]

// The palette opens with ⌘K on macOS and Ctrl+K elsewhere; show the platform's
// own modifier so the hint matches the key the user actually presses.
const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac|iP(hone|ad|od)/.test(navigator.platform)
const SHORTCUT_HINT = IS_MAC ? "⌘K" : "Ctrl K"

/**
 * Global command-palette search across all MIGs (authored content) and Message
 * Definitions (deduped across versions). Opens with ⌘/Ctrl-K or the header
 * button; a result navigates to its screen and deep-links the element via the
 * route's `?path=` so the element tree selects and scrolls to it.
 */
export function GlobalSearch({ repo }: { repo: ERepository }) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<SearchScope>("migs")
  const [query, setQuery] = useState("")
  const [migs, setMigs] = useState<MessageImplementationGuide[]>([])
  const [active, setActive] = useState(0)
  // The message index is heavy; built in the background (see prewarm effect).
  const [indexReady, setIndexReady] = useState(() => isMessageIndexReady(repo))

  const inputRef = useRef<HTMLInputElement>(null)
  const rowRefs = useRef<(HTMLDivElement | null)[]>([])

  // ⌘/Ctrl-K toggles the palette from anywhere.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // MIGs change as the user edits them, so (re)load each time the palette opens.
  useEffect(() => {
    if (!open) return
    let alive = true
    loadAllMigs()
      .then((all) => alive && setMigs(all))
      .catch((err) => console.error("Search: failed to load MIGs:", err))
    return () => {
      alive = false
    }
  }, [open])

  // Build the message index in the background the first time it's needed, so the
  // (potentially large) walk never blocks a keystroke.
  useEffect(() => {
    if (!open || scope !== "messages" || indexReady) return
    let alive = true
    prewarmMessageIndex(repo)
      .then(() => alive && setIndexReady(true))
      .catch((err) => console.error("Search: failed to index messages:", err))
    return () => {
      alive = false
    }
  }, [open, scope, repo, indexReady])

  // Defer the heavy scan off the keystroke so typing stays responsive.
  const deferred = useDeferredValue(query)
  const messageHits = useMemo(
    () =>
      open && scope === "messages" && indexReady
        ? searchMessages(repo, deferred)
        : [],
    [open, scope, repo, deferred, indexReady]
  )
  const migHits = useMemo(
    () => (open && scope === "migs" ? searchMigs(repo, migs, deferred) : []),
    [open, scope, repo, migs, deferred]
  )

  const count = scope === "messages" ? messageHits.length : migHits.length
  const shown = Math.min(count, SHOWN)

  // Reset the keyboard cursor to the top whenever the result set changes —
  // adjusted during render (not in an effect) by comparing the prior key.
  const resultsKey = `${scope} ${deferred}`
  const [activeKey, setActiveKey] = useState(resultsKey)
  if (activeKey !== resultsKey) {
    setActiveKey(resultsKey)
    setActive(0)
  }

  useEffect(() => {
    rowRefs.current[active]?.scrollIntoView({ block: "nearest" })
  }, [active])

  const close = () => setOpen(false)

  const goMessage = (hit: MessageHit, identifier: string) => {
    navigate({
      name: "message",
      code: identifier,
      path: hitTargetPath(hit.xmlPath, hit.field, hit.detail),
    })
    close()
  }
  const goMig = (hit: MigHit) => {
    navigate({
      name: "mig",
      key: hit.migKey,
      path: hit.xmlPath
        ? hitTargetPath(hit.xmlPath, hit.field, hit.detail)
        : undefined,
    })
    close()
  }

  const activateActive = () => {
    if (scope === "messages") {
      const hit = messageHits[active]
      if (hit) goMessage(hit, hit.latestIdentifier)
    } else {
      const hit = migHits[active]
      if (hit) goMig(hit)
    }
  }

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, shown - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      activateActive()
    }
  }

  const tooShort = deferred.trim().length < MIN_QUERY

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 text-muted-foreground"
        title={`Search (${SHORTCUT_HINT})`}
        aria-label="Search MIGs and messages"
      >
        <MagnifyingGlassIcon aria-hidden />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border border-border px-1 text-[0.625rem] sm:inline">
          {SHORTCUT_HINT}
        </kbd>
      </Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content
            aria-label="Search MIGs and messages"
            onOpenAutoFocus={(e) => {
              e.preventDefault()
              inputRef.current?.focus()
            }}
            className="fixed top-[12vh] left-1/2 z-50 flex max-h-[76vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-lg outline-none"
          >
            <Dialog.Title className="sr-only">
              Search MIGs and messages
            </Dialog.Title>

            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <MagnifyingGlassIcon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={
                  scope === "messages"
                    ? "Search message definitions…"
                    : "Search your MIGs…"
                }
                aria-label="Search query"
                role="combobox"
                aria-expanded
                aria-controls={LISTBOX_ID}
                aria-activedescendant={shown > 0 ? rowId(active) : undefined}
                className="h-7 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <div
                role="tablist"
                aria-label="Search scope"
                className="flex shrink-0 rounded-md border border-border p-0.5 text-xs"
              >
                {SCOPES.map((s) => (
                  <button
                    key={s.value}
                    role="tab"
                    aria-selected={scope === s.value}
                    onClick={() => setScope(s.value)}
                    className={cn(
                      "rounded px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                      scope === s.value
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              id={LISTBOX_ID}
              role="listbox"
              aria-label="Search results"
              className="min-h-0 flex-1 overflow-y-auto p-1.5"
            >
              {tooShort ? (
                <Hint>Type at least {MIN_QUERY} characters to search.</Hint>
              ) : scope === "messages" && !indexReady ? (
                <Hint>Indexing message definitions…</Hint>
              ) : count === 0 ? (
                <Hint>No matches for “{deferred.trim()}”.</Hint>
              ) : scope === "messages" ? (
                messageHits.slice(0, SHOWN).map((hit, i) => (
                  <MessageRow
                    key={`${hit.shortCode}|${hit.xmlPath}|${hit.field}|${hit.detail ?? ""}`}
                    id={rowId(i)}
                    ref={(el) => {
                      rowRefs.current[i] = el
                    }}
                    hit={hit}
                    active={i === active}
                    onHover={() => setActive(i)}
                    onOpen={(identifier) => goMessage(hit, identifier)}
                  />
                ))
              ) : (
                migHits.slice(0, SHOWN).map((hit, i) => (
                  <MigRow
                    key={`${hit.migKey}|${hit.xmlPath ?? ""}|${hit.field}|${hit.detail ?? ""}`}
                    id={rowId(i)}
                    ref={(el) => {
                      rowRefs.current[i] = el
                    }}
                    hit={hit}
                    active={i === active}
                    onHover={() => setActive(i)}
                    onOpen={() => goMig(hit)}
                  />
                ))
              )}
            </div>

            {!tooShort && count > 0 && (
              <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-[0.625rem] text-muted-foreground">
                <span>
                  {count} match{count === 1 ? "" : "es"}
                  {count > shown ? ` (showing ${shown})` : ""}
                </span>
                <span>↑↓ to move · ↵ to open · esc to close</span>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}

/** Collapse a long xmlPath to its trailing segments; full path stays in `title`. */
function collapsePath(xmlPath: string, keep = 3): string {
  const segs = xmlPath.split("/").filter(Boolean)
  if (segs.length <= keep) return "/" + segs.join("/")
  return "…/" + segs.slice(-keep).join("/")
}

function FieldBadge({ label }: { label: string }) {
  return (
    <span className="shrink-0 rounded-sm bg-muted px-1 text-[0.625rem] text-muted-foreground">
      {label}
    </span>
  )
}

/** A snippet with its matched span highlighted. */
function SnippetText({ snippet }: { snippet: Snippet }) {
  return (
    <span className="text-xs text-muted-foreground">
      {snippet.before}
      {snippet.match && (
        <mark className="rounded-sm bg-primary/20 text-foreground">
          {snippet.match}
        </mark>
      )}
      {snippet.after}
    </span>
  )
}

const rowClass = (active: boolean) =>
  cn(
    "w-full cursor-pointer rounded-md px-2 py-1.5 text-left outline-none",
    active ? "bg-muted" : "hover:bg-muted/60"
  )

function MessageRow({
  id,
  hit,
  active,
  onHover,
  onOpen,
  ref,
}: {
  id: string
  hit: MessageHit
  active: boolean
  onHover: () => void
  onOpen: (identifier: string) => void
  ref?: React.Ref<HTMLDivElement>
}) {
  return (
    <div
      id={id}
      ref={ref}
      role="option"
      aria-selected={active}
      onMouseMove={onHover}
      onClick={() => onOpen(hit.latestIdentifier)}
      className={rowClass(active)}
    >
      <div className="flex items-center gap-1.5">
        <span className="truncate text-sm font-medium">{hit.elementName}</span>
        <FieldBadge label={fieldLabel(hit.field, hit.detail)} />
      </div>
      <div className="truncate text-[0.6875rem] text-muted-foreground">
        <code className="text-foreground/70">{hit.shortCode}</code> ·{" "}
        <span title={hit.xmlPath}>{collapsePath(hit.xmlPath)}</span> ·{" "}
        {hit.area}
      </div>
      <div className="mt-1 flex flex-col gap-1">
        {hit.clusters.map((cluster, ci) => (
          <div
            key={ci}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
          >
            <SnippetText snippet={cluster.snippet} />
            <span className="flex flex-wrap gap-1">
              {cluster.versions.map((v) => (
                <button
                  key={v.identifier}
                  title={v.identifier}
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpen(v.identifier)
                  }}
                  className="rounded-sm border border-border px-1 text-[0.625rem] text-muted-foreground hover:bg-background hover:text-foreground"
                >
                  {v.short}
                </button>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MigRow({
  id,
  hit,
  active,
  onHover,
  onOpen,
  ref,
}: {
  id: string
  hit: MigHit
  active: boolean
  onHover: () => void
  onOpen: () => void
  ref?: React.Ref<HTMLDivElement>
}) {
  return (
    <div
      id={id}
      ref={ref}
      role="option"
      aria-selected={active}
      onMouseMove={onHover}
      onClick={onOpen}
      className={rowClass(active)}
    >
      <div className="flex items-center gap-1.5">
        <span className="truncate text-sm font-medium">{hit.migName}</span>
        <code className="shrink-0 rounded-sm bg-muted px-1 text-[0.625rem] text-muted-foreground">
          {hit.migVersion}
        </code>
        <FieldBadge label={fieldLabel(hit.field, hit.detail)} />
      </div>
      <div className="truncate text-[0.6875rem] text-muted-foreground">
        {hit.xmlPath ? (
          <>
            <span className="text-foreground/70">{hit.elementName}</span> ·{" "}
            <span title={hit.xmlPath}>{collapsePath(hit.xmlPath)}</span>
          </>
        ) : (
          "MIG metadata"
        )}
      </div>
      <div className="mt-1">
        <SnippetText snippet={hit.snippet} />
      </div>
    </div>
  )
}
