import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react"
import {
  ArrowClockwiseIcon,
  CaretRightIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import {
  groupMessages,
  type MessageGroup,
} from "@/core/erepository/messageGroups"
import { loadAllMigs } from "@/core/storage/migStore"
import type { BusinessArea, ERepository } from "@/core/types/types"
import { hashFor } from "@/app/routes"
import { cn } from "@/lib/utils"

interface ViewArea {
  area: BusinessArea
  groups: MessageGroup[]
  /** Effective expansion (forced open while filtering). */
  expanded: boolean
}

// Flattened, in-order list of currently navigable nodes — drives arrow keys.
type FlatNode =
  | {
      kind: "area"
      id: string
      areaCode: string
      hasChildren: boolean
      expanded: boolean
    }
  | { kind: "group"; id: string; areaCode: string; shortCode: string }

const areaId = (code: string) => `area:${code}`
const groupId = (areaCode: string, shortCode: string) =>
  `group:${areaCode}/${shortCode}`

function matches(text: string, q: string) {
  return text.toLowerCase().includes(q)
}

export function ERepositoryBrowser({
  repo,
  onUpdateRepository,
  migMessageIds,
}: {
  repo: ERepository
  /** Re-upload a newer e-Repository file (page header action). */
  onUpdateRepository: () => void
  /**
   * Message identifiers that already have a MIG; a group is flagged if any
   * version is present. When omitted, the browser loads them from storage.
   */
  migMessageIds?: Set<string>
}) {
  const [filter, setFilter] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [loadedMigIds, setLoadedMigIds] = useState<Set<string>>(() => new Set())

  const filterRef = useRef<HTMLInputElement>(null)
  const nodeRefs = useRef(new Map<string, HTMLElement>())

  // Load MIG'd message identifiers from storage unless the caller supplied them.
  const usingProvidedMigIds = migMessageIds !== undefined
  useEffect(() => {
    if (usingProvidedMigIds) return
    let active = true
    loadAllMigs()
      .then((migs) => {
        if (active)
          setLoadedMigIds(new Set(migs.map((m) => m.messageIdentifier)))
      })
      .catch((err) => console.error("Failed to load MIGs for badges:", err))
    return () => {
      active = false
    }
  }, [usingProvidedMigIds])

  const migIds = migMessageIds ?? loadedMigIds

  // Group each area's messages once per repo.
  const areaGroups = useMemo(
    () =>
      repo.businessAreas.map((area) => ({
        area,
        groups: groupMessages(area.messages),
      })),
    [repo]
  )

  const filtering = filter.trim() !== ""
  const q = filter.trim().toLowerCase()

  const viewAreas = useMemo<ViewArea[]>(() => {
    if (!filtering) {
      return areaGroups.map(({ area, groups }) => ({
        area,
        groups,
        expanded: expanded.has(area.code),
      }))
    }
    const result: ViewArea[] = []
    for (const { area, groups } of areaGroups) {
      const areaMatches = matches(area.name, q) || matches(area.code, q)
      const shownGroups = areaMatches
        ? groups
        : groups.filter(
            (g) =>
              matches(g.label, q) ||
              matches(g.shortCode, q) ||
              g.versions.some((v) => matches(v.identifier, q))
          )
      if (areaMatches || shownGroups.length > 0) {
        result.push({ area, groups: shownGroups, expanded: true })
      }
    }
    return result
  }, [areaGroups, expanded, filtering, q])

  const flatNodes = useMemo<FlatNode[]>(() => {
    const nodes: FlatNode[] = []
    for (const { area, groups, expanded: open } of viewAreas) {
      nodes.push({
        kind: "area",
        id: areaId(area.code),
        areaCode: area.code,
        hasChildren: groups.length > 0,
        expanded: open,
      })
      if (open) {
        for (const g of groups) {
          nodes.push({
            kind: "group",
            id: groupId(area.code, g.shortCode),
            areaCode: area.code,
            shortCode: g.shortCode,
          })
        }
      }
    }
    return nodes
  }, [viewAreas])

  // The single tab-stop. Falls back to the first node if the focused one vanished.
  const activeId =
    focusedId && flatNodes.some((n) => n.id === focusedId)
      ? focusedId
      : (flatNodes[0]?.id ?? null)

  const toggle = (code: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })

  const open = (code: string) => setExpanded((prev) => new Set(prev).add(code))

  const focusNode = (id: string) => {
    setFocusedId(id)
    nodeRefs.current.get(id)?.focus()
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLUListElement>) => {
    if (!activeId) return
    const idx = flatNodes.findIndex((n) => n.id === activeId)
    if (idx < 0) return
    const node = flatNodes[idx]

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        if (idx < flatNodes.length - 1) focusNode(flatNodes[idx + 1].id)
        break
      case "ArrowUp":
        e.preventDefault()
        if (idx > 0) focusNode(flatNodes[idx - 1].id)
        break
      case "Home":
        e.preventDefault()
        focusNode(flatNodes[0].id)
        break
      case "End":
        e.preventDefault()
        focusNode(flatNodes[flatNodes.length - 1].id)
        break
      case "ArrowRight":
        e.preventDefault()
        if (node.kind === "area" && node.hasChildren) {
          if (!node.expanded) open(node.areaCode)
          else if (idx < flatNodes.length - 1) focusNode(flatNodes[idx + 1].id)
        }
        break
      case "ArrowLeft":
        e.preventDefault()
        if (node.kind === "area" && node.expanded) {
          toggle(node.areaCode)
        } else if (node.kind === "group") {
          focusNode(areaId(node.areaCode))
        }
        break
      case " ":
        e.preventDefault()
        if (node.kind === "area") toggle(node.areaCode)
        break
      case "Enter":
        if (node.kind === "area") {
          e.preventDefault()
          toggle(node.areaCode)
        }
        // groups are <a href> — let the browser follow the link
        break
    }
  }

  // Focus the filter on "/" (Ctrl/Cmd+F is intentionally left to native find).
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && target.closest("input, textarea, [contenteditable='true']"))
        return
      e.preventDefault()
      filterRef.current?.focus()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const setRef = (id: string) => (el: HTMLElement | null) => {
    if (el) nodeRefs.current.set(id, el)
    else nodeRefs.current.delete(id)
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6 xl:max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-base font-semibold tracking-tight">e-Repository</h1>
        <Button variant="outline" size="sm" onClick={onUpdateRepository}>
          <ArrowClockwiseIcon data-icon="inline-start" aria-hidden />
          Update e-Repository
        </Button>
      </div>

      <div className="relative">
        <MagnifyingGlassIcon
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          ref={filterRef}
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter business areas and messages…  ( / )"
          aria-label="Filter business areas and messages"
          className="h-8 w-full rounded-md border border-border bg-transparent pr-2 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </div>

      {flatNodes.length === 0 ? (
        <p className="px-1 py-8 text-center text-sm text-muted-foreground">
          No business areas or messages match “{filter}”.
        </p>
      ) : (
        <ul
          role="tree"
          aria-label="e-Repository"
          className="flex flex-col"
          onKeyDown={onKeyDown}
        >
          {viewAreas.map(({ area, groups, expanded: areaOpen }) => (
            <li role="none" key={area.code}>
              <div
                role="treeitem"
                aria-level={1}
                aria-expanded={groups.length > 0 ? areaOpen : undefined}
                aria-selected={activeId === areaId(area.code)}
                tabIndex={activeId === areaId(area.code) ? 0 : -1}
                ref={setRef(areaId(area.code))}
                onClick={() => toggle(area.code)}
                onFocus={() => setFocusedId(areaId(area.code))}
                className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <CaretRightIcon
                  className={cn(
                    "size-3.5 shrink-0 text-muted-foreground transition-transform",
                    areaOpen && "rotate-90",
                    groups.length === 0 && "invisible"
                  )}
                  aria-hidden
                />
                <span className="text-sm font-medium">{area.name}</span>
                <Badge>{area.code}</Badge>
                <span className="ml-auto text-xs text-muted-foreground">
                  {groups.length} message{groups.length === 1 ? "" : "s"}
                </span>
              </div>

              <Disclosure
                collapsed={!areaOpen && !filtering}
                onReveal={() => open(area.code)}
              >
                {groups.map((g) => {
                  const hasMig = g.versions.some((v) =>
                    migIds.has(v.identifier)
                  )
                  const id = groupId(area.code, g.shortCode)
                  return (
                    <li role="none" key={g.shortCode}>
                      <a
                        role="treeitem"
                        aria-level={2}
                        aria-selected={activeId === id}
                        tabIndex={activeId === id ? 0 : -1}
                        ref={setRef(id)}
                        href={hashFor({ name: "message", code: g.shortCode })}
                        onFocus={() => setFocusedId(id)}
                        className="ml-5 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm no-underline outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30"
                      >
                        <span className="font-mono text-xs">{g.label}</span>
                        <Badge>{g.shortCode}</Badge>
                        {hasMig && (
                          <span className="rounded-sm bg-primary/10 px-1 text-[0.625rem] font-medium text-primary">
                            MIG
                          </span>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {g.versions.length} version
                          {g.versions.length === 1 ? "" : "s"}
                        </span>
                      </a>
                    </li>
                  )
                })}
              </Disclosure>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-sm bg-muted px-1 text-[0.625rem] text-muted-foreground">
      {children}
    </code>
  )
}

/**
 * Group container that keeps children in the DOM when collapsed, hidden via
 * `hidden="until-found"` so the browser's native Ctrl-F can locate and reveal
 * them. Reveal fires `beforematch`, which we forward to sync expansion state.
 */
function Disclosure({
  collapsed,
  onReveal,
  children,
}: {
  collapsed: boolean
  onReveal: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (collapsed) el.setAttribute("hidden", "until-found")
    else el.removeAttribute("hidden")
  }, [collapsed])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = () => onReveal()
    el.addEventListener("beforematch", handler)
    return () => el.removeEventListener("beforematch", handler)
  }, [onReveal])

  return (
    <ul ref={ref} role="group" className="flex flex-col">
      {children}
    </ul>
  )
}
