import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
} from "react"
import { CaretRightIcon, CheckIcon, MagnifyingGlassIcon } from "@phosphor-icons/react"
import type { Constraint, ElementOverrides, MessageElement } from "@/core/types/types"
import { cn } from "@/lib/utils"

/** Number of rows ↕ a PageUp/PageDown jumps. */
const PAGE = 10

// Flattened, in-order list of the currently visible tree nodes — drives the
// roving tabindex and arrow-key navigation (collapsed subtrees are omitted).
type FlatNode = {
  path: string
  level: number
  parentPath: string | null
  hasChildren: boolean
  expanded: boolean
  /** Effective `maxOccurs:0` on this node or an ancestor — styled as excluded. */
  excluded: boolean
} & (
  | {
      kind: "element"
      element: MessageElement
      /** Effective cardinality (own + inherited override over the base). */
      minOccurs: number
      maxOccurs: number | null
    }
  | { kind: "constraint"; constraint: Constraint; origin: ConstraintOrigin; disabled: boolean }
)

/** The focused/selected node, handed to the detail-panel renderer (selection follows focus). */
export type SelectedNode =
  | { kind: "element"; element: MessageElement; path: string }
  | {
      kind: "constraint"
      constraint: Constraint
      path: string
      /** xmlPath of the owning element. */
      parentPath: string
      /** Standard (ISO), this MIG's own, or an inherited (parent-MIG) constraint. */
      origin: ConstraintOrigin
    }

/** Imperative tree actions handed to the detail-panel renderer. */
export type TreeActions = {
  /**
   * Focus and select the node at `path`. If it isn't rendered yet (e.g. a
   * constraint the detail panel just added to the MIG), focus lands on it once
   * it next appears.
   */
  select: (path: string) => void
}

/** Imperative handle for selecting a node from outside the tree (e.g. diagnostics). */
export type ElementTreeHandle = TreeActions

/**
 * Whether `el` is excluded in its own right — its effective `maxOccurs` is 0.
 * In the MIG editor exclusion is set via a per-path override (`maxOccurs: 0`);
 * with no overrides this is just the base message's `maxOccurs`.
 */
function isOwnExcluded(
  path: string,
  el: MessageElement,
  overrides: ElementOverrides | undefined,
): boolean {
  const override = overrides?.[path]
  const maxOccurs = override && "maxOccurs" in override ? override.maxOccurs : el.maxOccurs
  return maxOccurs === 0
}

/** Effective cardinality at `path` — its override (own + inherited) over the base. */
function effectiveOccurs(
  path: string,
  el: MessageElement,
  overrides: ElementOverrides | undefined,
): { minOccurs: number; maxOccurs: number | null } {
  const override = overrides?.[path]
  return {
    minOccurs: override && "minOccurs" in override ? (override.minOccurs ?? 0) : el.minOccurs,
    maxOccurs: override && "maxOccurs" in override ? (override.maxOccurs ?? null) : el.maxOccurs,
  }
}

/** Where a constraint shown in the tree comes from. */
export type ConstraintOrigin = "standard" | "own" | "inherited"

/**
 * An element's constraints as shown in the tree: the standard (ISO) ones, then
 * the additional ones from the **effective** override (so a parent MIG's added
 * constraints are visible too), each tagged with its origin — `own` when this
 * MIG declares it, otherwise `inherited`.
 */
function constraintsAt(
  path: string,
  el: MessageElement,
  ownOverrides: ElementOverrides | undefined,
  effectiveOverrides: ElementOverrides | undefined,
): { constraint: Constraint; origin: ConstraintOrigin; disabled: boolean }[] {
  const overrides = effectiveOverrides?.[path]?.constraintOverrides
  const disabled = (name: string) => overrides?.[name]?.disabled ?? false
  const standard = el.constraints.map((constraint) => ({
    constraint,
    origin: "standard" as const,
    disabled: disabled(constraint.name),
  }))
  const ownNames = new Set(
    (ownOverrides?.[path]?.additionalConstraints ?? []).map((c) => c.name),
  )
  const additional = (effectiveOverrides?.[path]?.additionalConstraints ?? []).map((constraint) => ({
    constraint,
    origin: ownNames.has(constraint.name) ? ("own" as const) : ("inherited" as const),
    disabled: disabled(constraint.name),
  }))
  return [...standard, ...additional]
}

/** Count elements excluded in their own right (effective `maxOccurs:0`) tree-wide. */
function countExcluded(root: MessageElement, overrides: ElementOverrides | undefined): number {
  let n = 0
  const walk = (el: MessageElement, path: string) => {
    if (isOwnExcluded(path, el, overrides)) n++
    for (const child of el.elements) walk(child, `${path}/${child.xmlTag}`)
  }
  walk(root, root.xmlTag)
  return n
}

/**
 * A computed filter: `keep` is every path to render (matches + their
 * ancestors + matching constraints), `expand` is every ancestor to auto-open so
 * the matches are revealed. Built once per query in `buildFilter`.
 */
type TreeFilter = { keep: Set<string>; expand: Set<string> }

function matchesQuery(text: string, q: string): boolean {
  return text.toLowerCase().includes(q)
}

/**
 * Compute the kept/expanded paths for a query. An element is kept when it (or
 * any descendant element/constraint) matches; ancestors of a match are kept and
 * auto-expanded so the match is visible. `q` must already be lower-cased.
 */
function buildFilter(
  root: MessageElement,
  q: string,
  overrides: ElementOverrides | undefined,
): TreeFilter {
  const keep = new Set<string>()
  const expand = new Set<string>()
  const visit = (el: MessageElement, path: string): boolean => {
    const selfMatch = matchesQuery(el.name, q) || matchesQuery(el.xmlTag, q)
    let descMatch = false
    for (const child of el.elements) {
      if (visit(child, `${path}/${child.xmlTag}`)) descMatch = true
    }
    for (const { constraint } of constraintsAt(path, el, overrides, overrides)) {
      if (matchesQuery(constraint.name, q)) {
        keep.add(`${path}/${constraint.name}`)
        descMatch = true
      }
    }
    if (selfMatch || descMatch) keep.add(path)
    if (descMatch) expand.add(path)
    return selfMatch || descMatch
  }
  visit(root, root.xmlTag)
  return { keep, expand }
}

/**
 * Walk the element tree, emitting only nodes whose ancestors are all expanded.
 * When `filter` is set, prune to its `keep` set and force its `expand` paths
 * open (a node also stays open if the user expanded it). When `hideExcluded` is
 * set, drop `maxOccurs:0` elements (and their subtrees) entirely. `ownOverrides`
 * drive the MIG-specific constraint nodes; `effectiveOverrides` (own + inherited)
 * drive exclusion styling and the displayed cardinality.
 */
function flattenTree(
  root: MessageElement,
  expanded: Set<string>,
  filter: TreeFilter | null,
  hideExcluded: boolean,
  ownOverrides: ElementOverrides | undefined,
  effectiveOverrides: ElementOverrides | undefined,
): FlatNode[] {
  const out: FlatNode[] = []
  const walk = (
    el: MessageElement,
    path: string,
    level: number,
    parentPath: string | null,
    ancestorExcluded: boolean,
  ) => {
    if (filter && !filter.keep.has(path)) return
    const excluded = ancestorExcluded || isOwnExcluded(path, el, effectiveOverrides)
    if (hideExcluded && excluded) return

    // Children are visible unless filtered out or (when hiding) excluded.
    const childEls = el.elements.filter((c) => {
      if (filter && !filter.keep.has(`${path}/${c.xmlTag}`)) return false
      if (hideExcluded && isOwnExcluded(`${path}/${c.xmlTag}`, c, effectiveOverrides)) return false
      return true
    })
    const cons = constraintsAt(path, el, ownOverrides, effectiveOverrides)
    const childCons = filter
      ? cons.filter((c) => filter.keep.has(`${path}/${c.constraint.name}`))
      : cons
    const hasChildren = childEls.length > 0 || childCons.length > 0
    const isOpen = filter ? filter.expand.has(path) || expanded.has(path) : expanded.has(path)
    out.push({
      kind: "element",
      element: el,
      ...effectiveOccurs(path, el, effectiveOverrides),
      path,
      level,
      parentPath,
      hasChildren,
      expanded: isOpen,
      excluded,
    })
    if (!hasChildren || !isOpen) return
    for (const child of childEls) {
      walk(child, `${path}/${child.xmlTag}`, level + 1, path, excluded)
    }
    for (const { constraint, origin, disabled } of childCons) {
      out.push({
        kind: "constraint",
        constraint,
        origin,
        disabled,
        path: `${path}/${constraint.name}`,
        level: level + 1,
        parentPath: path,
        hasChildren: false,
        expanded: false,
        excluded,
      })
    }
  }
  walk(root, root.xmlTag, 0, null, false)
  return out
}

/** Collect every expandable path at or under `el` (for the `*` subtree-expand key). */
function collectExpandable(el: MessageElement, path: string, into: Set<string>): void {
  if (el.elements.length > 0 || el.constraints.length > 0) into.add(path)
  for (const child of el.elements) {
    collectExpandable(child, `${path}/${child.xmlTag}`, into)
  }
}

function toSelected(node: FlatNode): SelectedNode {
  return node.kind === "constraint"
    ? {
        kind: "constraint",
        constraint: node.constraint,
        path: node.path,
        parentPath: node.parentPath ?? "",
        origin: node.origin,
      }
    : { kind: "element", element: node.element, path: node.path }
}

/**
 * Keyboard-first element tree (FUNCTIONALITY §5.6 / §10): roving-tabindex ARIA
 * `tree` with a filter box, Show-XML-tags and Hide-excluded toggles, and a
 * detail pane wired to selection-follows-focus via `renderDetail`. Shared by the
 * read-only Message Explorer and the MIG Editor.
 *
 * Internal state (expansion, focus, filter) initializes from `root`, so callers
 * must remount (via `key`) when `root` changes to a different message.
 */
export function ElementTree({
  root,
  ariaLabel,
  renderDetail,
  elementOverrides,
  effectiveOverrides,
  ref,
}: {
  root: MessageElement
  ariaLabel: string
  renderDetail: (selected: SelectedNode | null, actions: TreeActions) => ReactNode
  /**
   * This MIG's **own** overrides keyed by `xmlPath` — each path's
   * `additionalConstraints` appear as MIG-specific tree nodes. Omitted by the
   * read-only Message Explorer.
   */
  elementOverrides?: ElementOverrides
  /**
   * **Effective** overrides (own merged over the inherited parent chain) — drive
   * the displayed cardinality and the excluded styling/count. Defaults to
   * `elementOverrides` when omitted (no inheritance); both omitted = the base
   * message (Message Explorer).
   */
  effectiveOverrides?: ElementOverrides
  /** Imperative handle to select a node from outside (e.g. the diagnostics drawer). */
  ref?: Ref<ElementTreeHandle>
}) {
  const effective = effectiveOverrides ?? elementOverrides
  const [showXmlTags, setShowXmlTags] = useState(false)
  // Root is expanded by default; expansion is keyed by xmlPath so the keyboard
  // handler can drive it centrally (each node no longer owns its open state).
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([root.xmlTag]))
  const [focusedPath, setFocusedPath] = useState<string | null>(null)
  const [filter, setFilter] = useState("")
  const [hideExcluded, setHideExcluded] = useState(false)

  const nodeRefs = useRef(new Map<string, HTMLElement>())
  const filterRef = useRef<HTMLInputElement>(null)

  const excludedCount = useMemo(() => countExcluded(root, effective), [root, effective])
  const q = filter.trim().toLowerCase()
  const treeFilter = useMemo(
    () => (q ? buildFilter(root, q, effective) : null),
    [root, q, effective],
  )
  const flatNodes = useMemo(
    () => flattenTree(root, expanded, treeFilter, hideExcluded, elementOverrides, effective),
    [root, expanded, treeFilter, hideExcluded, elementOverrides, effective],
  )
  const noMatches = treeFilter !== null && flatNodes.length === 0

  // The single tab-stop; falls back to the root if the focused node vanished
  // (e.g. its parent was collapsed). Selection follows focus, so this also
  // drives the detail panel.
  const activeId =
    focusedPath && flatNodes.some((n) => n.path === focusedPath)
      ? focusedPath
      : (flatNodes[0]?.path ?? null)
  const active = flatNodes.find((n) => n.path === activeId) ?? flatNodes[0]

  const open = (path: string) => setExpanded((prev) => new Set(prev).add(path))
  const collapse = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.delete(path)
      return next
    })
  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const focusNode = (path: string) => {
    setFocusedPath(path)
    nodeRefs.current.get(path)?.focus()
  }

  // A node requested by `select` that wasn't mounted yet (e.g. a constraint the
  // detail panel just added). The effect below focuses it once it renders.
  const pendingFocus = useRef<string | null>(null)
  const select = (path: string) => {
    // Open every ancestor so the target is reachable (its parent may be collapsed).
    const parts = path.split("/")
    if (parts.length > 1) {
      setExpanded((prev) => {
        const next = new Set(prev)
        for (let i = 1; i < parts.length; i++) next.add(parts.slice(0, i).join("/"))
        return next
      })
    }
    setFocusedPath(path)
    const node = nodeRefs.current.get(path)
    if (node) node.focus()
    else pendingFocus.current = path
  }
  useEffect(() => {
    const path = pendingFocus.current
    if (path && nodeRefs.current.has(path)) {
      pendingFocus.current = null
      nodeRefs.current.get(path)?.focus()
    }
  })

  // Expose `select` so the diagnostics drawer can jump to an element. `select` is
  // behaviorally stable (only touches state setters and refs).
  useImperativeHandle(ref, () => ({ select }), [])

  const onKeyDown = (e: ReactKeyboardEvent<HTMLUListElement>) => {
    if (!active) return
    const idx = flatNodes.findIndex((n) => n.path === active.path)
    if (idx < 0) return
    const node = flatNodes[idx]

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        if (idx < flatNodes.length - 1) focusNode(flatNodes[idx + 1].path)
        break
      case "ArrowUp":
        e.preventDefault()
        if (idx > 0) focusNode(flatNodes[idx - 1].path)
        break
      case "Home":
        e.preventDefault()
        focusNode(flatNodes[0].path)
        break
      case "End":
        e.preventDefault()
        focusNode(flatNodes[flatNodes.length - 1].path)
        break
      case "PageDown":
        e.preventDefault()
        focusNode(flatNodes[Math.min(idx + PAGE, flatNodes.length - 1)].path)
        break
      case "PageUp":
        e.preventDefault()
        focusNode(flatNodes[Math.max(idx - PAGE, 0)].path)
        break
      case "ArrowRight":
        e.preventDefault()
        if (node.hasChildren && !node.expanded) open(node.path)
        else if (node.hasChildren && idx < flatNodes.length - 1) focusNode(flatNodes[idx + 1].path)
        break
      case "ArrowLeft":
        e.preventDefault()
        if (node.hasChildren && node.expanded) collapse(node.path)
        else if (node.parentPath) focusNode(node.parentPath)
        break
      case " ":
        e.preventDefault()
        if (node.hasChildren) toggle(node.path)
        break
      case "+":
        e.preventDefault()
        if (node.hasChildren) open(node.path)
        break
      case "-":
        e.preventDefault()
        if (node.hasChildren) collapse(node.path)
        break
      case "*":
        e.preventDefault()
        if (node.kind === "element" && node.hasChildren) {
          setExpanded((prev) => {
            const next = new Set(prev)
            collectExpandable(node.element, node.path, next)
            return next
          })
        }
        break
    }
  }

  const setRef = (path: string) => (el: HTMLElement | null) => {
    if (el) nodeRefs.current.set(path, el)
    else nodeRefs.current.delete(path)
  }

  // Focus the filter on "/" or Ctrl/Cmd+F. Unlike the e-Repository browser this
  // tree drops collapsed subtrees from the DOM, so native find can't reach them
  // — we bind Ctrl/Cmd+F too (FUNCTIONALITY §10, editor-tree behavior).
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      const cmdF = (e.metaKey || e.ctrlKey) && e.key === "f"
      const slash = e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey
      if (!cmdF && !slash) return
      const target = e.target as HTMLElement | null
      if (slash && target?.closest("input, textarea, [contenteditable='true']")) return
      e.preventDefault()
      filterRef.current?.focus()
      filterRef.current?.select()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  // Keyboard flow between the filter box and the tree.
  const onFilterKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (activeId) focusNode(activeId)
    } else if (e.key === "Escape" && filter) {
      e.preventDefault()
      setFilter("")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="relative min-w-56 flex-1">
          <MagnifyingGlassIcon
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            ref={filterRef}
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={onFilterKeyDown}
            placeholder="Filter elements and constraints…  ( / )"
            aria-label="Filter elements and constraints"
            className="h-8 w-full rounded-md border border-border bg-transparent pr-2 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>
        <label className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showXmlTags}
            onChange={(e) => setShowXmlTags(e.target.checked)}
          />
          Show XML tags
        </label>
        <label
          className={cn(
            "flex w-fit items-center gap-1.5 text-xs text-muted-foreground",
            excludedCount === 0 && "opacity-50",
          )}
        >
          <input
            type="checkbox"
            checked={hideExcluded}
            disabled={excludedCount === 0}
            onChange={(e) => setHideExcluded(e.target.checked)}
          />
          Hide excluded ({excludedCount})
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-[3fr_4fr]">
        {noMatches ? (
          <p className="px-1 py-8 text-center text-sm text-muted-foreground">
            No elements or constraints match “{filter.trim()}”.
          </p>
        ) : (
          <ul
            role="tree"
            aria-label={ariaLabel}
            className="flex flex-col text-sm"
            onKeyDown={onKeyDown}
          >
            {flatNodes.map((node) => (
              <TreeNode
                key={node.path}
                node={node}
                active={node.path === activeId}
                showXmlTags={showXmlTags}
                onFocus={() => setFocusedPath(node.path)}
                onSelect={() => focusNode(node.path)}
                onToggle={() => toggle(node.path)}
                setRef={setRef(node.path)}
              />
            ))}
          </ul>
        )}
        {/* `select` reads refs but is only invoked from the detail panel's event
            handlers (never during render), so the refs-in-render rule is moot. */}
        {/* eslint-disable-next-line react-hooks/refs */}
        {renderDetail(active ? toSelected(active) : null, { select })}
      </div>
    </div>
  )
}

function cardinality(minOccurs: number, maxOccurs: number | null): string {
  return `[${minOccurs}..${maxOccurs ?? "*"}]`
}

/**
 * A single visible tree row (`role="treeitem"`) — the whole row is the focus
 * target (roving tabindex). Selection follows focus, so `active` doubles as the
 * selected state. The caret is a mouse affordance; keyboard users expand via
 * Space / arrows on the focused row.
 */
function TreeNode({
  node,
  active,
  showXmlTags,
  onFocus,
  onSelect,
  onToggle,
  setRef,
}: {
  node: FlatNode
  active: boolean
  showXmlTags: boolean
  onFocus: () => void
  onSelect: () => void
  onToggle: () => void
  setRef: (el: HTMLElement | null) => void
}) {
  const label =
    node.kind === "element"
      ? showXmlTags
        ? node.element.xmlTag
        : node.element.name
      : node.constraint.name

  return (
    <li role="none">
      <div
        role="treeitem"
        aria-level={node.level + 1}
        aria-expanded={node.hasChildren ? node.expanded : undefined}
        aria-selected={active}
        aria-label={node.kind === "constraint" ? `Constraint ${label}` : label}
        tabIndex={active ? 0 : -1}
        ref={setRef}
        onFocus={onFocus}
        onClick={onSelect}
        style={{ paddingLeft: node.level === 0 ? 4 : node.level * 16 + 4 }}
        className={cn(
          "flex cursor-pointer items-center gap-1.5 rounded-md py-1 pr-1.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30",
          active && "bg-muted",
        )}
      >
        {node.hasChildren ? (
          <span
            role="presentation"
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted-foreground/10"
          >
            <CaretRightIcon className={cn("size-3.5", node.expanded && "rotate-90")} aria-hidden />
          </span>
        ) : node.kind === "constraint" ? (
          <CheckIcon className="size-3 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <span className="inline-block size-4 shrink-0" aria-hidden />
        )}
        <span
          className={cn(
            node.kind === "element" && "font-medium",
            (node.excluded || (node.kind === "constraint" && node.disabled)) &&
              "text-muted-foreground line-through",
          )}
        >
          {label}
        </span>
        {node.kind === "element" && (
          <span className="text-xs text-muted-foreground">
            {cardinality(node.minOccurs, node.maxOccurs)}
          </span>
        )}
        {node.excluded && (
          <span className="rounded-sm bg-muted px-1 text-[0.625rem] text-muted-foreground">
            excluded
          </span>
        )}
        {node.kind === "element" && node.element.isChoice && (
          <span className="rounded-sm bg-muted px-1 text-[0.625rem] text-muted-foreground">
            choice
          </span>
        )}
        {node.kind === "constraint" && node.origin === "own" && (
          <span className="rounded-sm bg-primary/10 px-1 text-[0.625rem] text-primary">added</span>
        )}
        {node.kind === "constraint" && node.origin === "inherited" && (
          <span className="rounded-sm bg-muted px-1 text-[0.625rem] text-muted-foreground">
            inherited
          </span>
        )}
        {node.kind === "constraint" && node.disabled && (
          <span className="rounded-sm bg-muted px-1 text-[0.625rem] text-muted-foreground">
            disabled
          </span>
        )}
      </div>
    </li>
  )
}

/** A labelled field row for the detail panel. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[0.625rem] tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="text-sm break-words">{children}</div>
    </div>
  )
}

/** The sticky, bordered right-pane region that holds a node's details. */
export function DetailPanel({ label, children }: { label: string; children: ReactNode }) {
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
