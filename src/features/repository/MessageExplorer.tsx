import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react"
import { CaretRight, Check, Plus } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { CreateMigDialog } from "@/features/mig/CreateMigDialog"
import { resolveMessage, type ResolvedMessage } from "@/core/erepository/resolveMessage"
import type { Constraint, ERepository, MessageElement } from "@/core/types/types"
import { hashFor } from "@/app/routes"
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
} & (
  | { kind: "element"; element: MessageElement }
  | { kind: "constraint"; constraint: Constraint }
)

/** Walk the element tree, emitting only nodes whose ancestors are all expanded. */
function flattenTree(root: MessageElement, expanded: Set<string>): FlatNode[] {
  const out: FlatNode[] = []
  const walk = (el: MessageElement, path: string, level: number, parentPath: string | null) => {
    const hasChildren = el.elements.length > 0 || el.constraints.length > 0
    const isOpen = expanded.has(path)
    out.push({ kind: "element", element: el, path, level, parentPath, hasChildren, expanded: isOpen })
    if (!hasChildren || !isOpen) return
    for (const child of el.elements) {
      walk(child, `${path}/${child.xmlTag}`, level + 1, path)
    }
    for (const c of el.constraints) {
      out.push({
        kind: "constraint",
        constraint: c,
        path: `${path}/${c.name}`,
        level: level + 1,
        parentPath: path,
        hasChildren: false,
        expanded: false,
      })
    }
  }
  walk(root, root.xmlTag, 0, null)
  return out
}

/** Collect every expandable path at or under `el` (for the `*` subtree-expand key). */
function collectExpandable(el: MessageElement, path: string, into: Set<string>): void {
  if (el.elements.length > 0 || el.constraints.length > 0) into.add(path)
  for (const child of el.elements) {
    collectExpandable(child, `${path}/${child.xmlTag}`, into)
  }
}

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
  const [createOpen, setCreateOpen] = useState(false)
  const [showXmlTags, setShowXmlTags] = useState(false)
  // Root is expanded by default; expansion is keyed by xmlPath so the keyboard
  // handler can drive it centrally (each node no longer owns its open state).
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([root.xmlTag]))
  const [focusedPath, setFocusedPath] = useState<string | null>(null)

  const nodeRefs = useRef(new Map<string, HTMLElement>())

  const flatNodes = useMemo(() => flattenTree(root, expanded), [root, expanded])

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

      <label className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={showXmlTags}
          onChange={(e) => setShowXmlTags(e.target.checked)}
        />
        Show XML tags
      </label>

      <div className="grid gap-4 md:grid-cols-[3fr_4fr]">
        <ul
          role="tree"
          aria-label={`${current.name} structure`}
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
        {active?.kind === "constraint" ? (
          <ConstraintDetail constraint={active.constraint} path={active.path} />
        ) : (
          active && <ElementDetail element={active.element} path={active.path} />
        )}
      </div>
    </div>
  )
}

function cardinality(e: MessageElement): string {
  return `[${e.minOccurs}..${e.maxOccurs ?? "*"}]`
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
            <CaretRight className={cn("size-3.5", node.expanded && "rotate-90")} aria-hidden />
          </span>
        ) : node.kind === "constraint" ? (
          <Check className="size-3 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <span className="inline-block size-4 shrink-0" aria-hidden />
        )}
        <span className={cn(node.kind === "element" && "font-medium")}>{label}</span>
        {node.kind === "element" && (
          <span className="text-xs text-muted-foreground">{cardinality(node.element)}</span>
        )}
        {node.kind === "element" && node.element.isChoice && (
          <span className="rounded-sm bg-muted px-1 text-[0.625rem] text-muted-foreground">
            choice
          </span>
        )}
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
          <span className="whitespace-pre-wrap">{constraint.definition}</span>
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
      {e.examples.length > 0 && <Field label="Examples">{e.examples.join(", ")}</Field>}
    </DetailPanel>
  )
}
