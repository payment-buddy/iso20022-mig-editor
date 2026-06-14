import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react"
import {
  CaretDownIcon,
  CaretUpIcon,
  DownloadSimpleIcon,
  GitDiffIcon,
  TrashIcon,
  TreeStructureIcon,
  UploadSimpleIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { getMigKey } from "@/core/mig/migKey"
import { shortCodeForIdentifier } from "@/core/erepository/messageIdentifier"
import {
  duplicateKeysOf,
  migsForResolution,
  type DuplicateResolution,
} from "@/core/mig/importDuplicates"
import { loadAllMigs, saveMig } from "@/core/storage/migStore"
import { loadLatestRevisionTimes } from "@/core/storage/revisionStore"
import { loadTrashCount, trashMig } from "@/core/storage/trashStore"
import type { MessageImplementationGuide } from "@/core/types/types"
import { hashFor, navigate } from "@/app/routes"
import { formatLocalDateTime } from "@/lib/datetime"
import { parseMigYaml } from "./parseMigYaml"
import { ImportDuplicateDialog } from "./ImportDuplicateDialog"
import { setPendingMerge } from "./pendingMerge"
import { downloadMigs } from "./downloadMigs"

type PendingImport = {
  incoming: MessageImplementationGuide[]
  duplicateKeys: Set<string>
  errors: string[]
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/** Sortable columns and the direction each one starts in on first click. */
type SortCol = "name" | "version" | "message" | "modified"
const SORT_DEFAULT_DIR: Record<SortCol, 1 | -1> = { name: 1, version: 1, message: 1, modified: -1 }

function keysBetween(keys: string[], a: string, b: string): string[] {
  const i = keys.indexOf(a)
  const j = keys.indexOf(b)
  if (i < 0 || j < 0) return []
  return i <= j ? keys.slice(i, j + 1) : keys.slice(j, i + 1)
}

export function MigHome() {
  const [migs, setMigs] = useState<MessageImplementationGuide[]>([])
  const [lastModified, setLastModified] = useState<Record<string, number>>({})
  const [sort, setSort] = useState<{ col: SortCol; dir: 1 | -1 }>({ col: "name", dir: 1 })
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const [anchorKey, setAnchorKey] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [trashCount, setTrashCount] = useState(0)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const selectAllRef = useRef<HTMLInputElement>(null)
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>())

  // Display order: sort by the active column, with a stable, direction-independent
  // key tiebreak so equal rows never jitter. Keyboard nav + range selection read
  // `keys` from this, so they follow the visible order.
  const sortedMigs = useMemo(() => {
    const primary = (a: MessageImplementationGuide, b: MessageImplementationGuide): number => {
      switch (sort.col) {
        case "name":
          return a.name.localeCompare(b.name, undefined, { numeric: true })
        case "version":
          return a.version.localeCompare(b.version, undefined, { numeric: true })
        case "message":
          return a.messageIdentifier.localeCompare(b.messageIdentifier, undefined, { numeric: true })
        case "modified":
          return (lastModified[getMigKey(a)] ?? 0) - (lastModified[getMigKey(b)] ?? 0)
      }
    }
    return [...migs].sort((a, b) => {
      const r = primary(a, b) * sort.dir
      return r !== 0 ? r : getMigKey(a).localeCompare(getMigKey(b))
    })
  }, [migs, sort, lastModified])

  const keys = sortedMigs.map(getMigKey)
  const activeKey = focusedKey && keys.includes(focusedKey) ? focusedKey : (keys[0] ?? null)
  const selectedMigs = migs.filter((m) => selected.has(getMigKey(m)))

  const refresh = useCallback(() => {
    Promise.all([loadAllMigs(), loadLatestRevisionTimes(), loadTrashCount()])
      .then(([loaded, times, trashed]) => {
        loaded.sort((a, b) => getMigKey(a).localeCompare(getMigKey(b)))
        setMigs(loaded)
        setLastModified(times)
        setTrashCount(trashed)
      })
      .catch((err) => console.error("Failed to load MIGs:", err))
  }, [])

  useEffect(refresh, [refresh])

  // Keep the select-all checkbox's indeterminate state in sync.
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selected.size > 0 && selected.size < migs.length
    }
  }, [selected, migs.length])

  const commitImport = useCallback(
    (toSave: MessageImplementationGuide[], problems: string[]) => {
      Promise.all(toSave.map(saveMig))
        .then(() => {
          setImportErrors(problems)
          refresh()
        })
        .catch((err) => console.error("Failed to import MIGs:", err))
    },
    [refresh],
  )

  const handleFiles = useCallback(
    async (files: FileList) => {
      const incoming: MessageImplementationGuide[] = []
      const problems: string[] = []
      for (const file of Array.from(files)) {
        const { migs: parsed, errors } = parseMigYaml(await file.text())
        incoming.push(...parsed)
        for (const error of errors) problems.push(`${file.name}: ${error}`)
      }
      // Defer the import to the user when any incoming MIG collides with a stored
      // one; otherwise save straight away.
      const duplicateKeys = duplicateKeysOf(incoming, migs.map(getMigKey))
      if (duplicateKeys.size > 0) {
        setPendingImport({ incoming, duplicateKeys, errors: problems })
        return
      }
      commitImport(incoming, problems)
    },
    [migs, commitImport],
  )

  const resolvePendingImport = (resolution: DuplicateResolution) => {
    if (!pendingImport) return
    const { incoming, duplicateKeys, errors } = pendingImport
    setPendingImport(null)
    commitImport(migsForResolution(incoming, duplicateKeys, resolution, Date.now()), errors)
  }

  // Merge is offered only for a single colliding MIG whose message family matches
  // the stored one — it hands the parsed upload to the merge screen (Compare-like).
  const mergeCandidate = (() => {
    if (!pendingImport || pendingImport.incoming.length !== 1 || pendingImport.duplicateKeys.size !== 1) {
      return null
    }
    const candidate = pendingImport.incoming[0]
    const existing = migs.find((m) => getMigKey(m) === getMigKey(candidate))
    if (
      !existing ||
      shortCodeForIdentifier(candidate.messageIdentifier) !==
        shortCodeForIdentifier(existing.messageIdentifier)
    ) {
      return null
    }
    return candidate
  })()

  const mergePendingImport = () => {
    if (!mergeCandidate) return
    const key = getMigKey(mergeCandidate)
    setPendingImport(null)
    setPendingMerge(key, mergeCandidate)
    navigate({ name: "merge", key })
  }

  const focusRow = (key: string) => {
    setFocusedKey(key)
    rowRefs.current.get(key)?.focus()
  }

  const moveFocus = (toIdx: number, extend: boolean) => {
    if (keys.length === 0) return
    const newKey = keys[clamp(toIdx, 0, keys.length - 1)]
    if (extend) {
      const anchor = anchorKey ?? activeKey ?? newKey
      setAnchorKey(anchor) // persist so successive Shift+Arrow extend from the same origin
      setSelected(new Set(keysBetween(keys, anchor, newKey)))
    } else {
      setAnchorKey(newKey)
    }
    focusRow(newKey)
  }

  const toggleOne = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const toggleAll = () =>
    setSelected((prev) => (prev.size === migs.length ? new Set() : new Set(keys)))

  // Click a header to sort by it; click the active one again to flip direction.
  const toggleSort = (col: SortCol) =>
    setSort((s) =>
      s.col === col ? { col, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 } : { col, dir: SORT_DEFAULT_DIR[col] },
    )

  const sortHeader = (col: SortCol, label: string) => {
    const active = sort.col === col
    return (
      <th
        scope="col"
        aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
        className="border-b border-border px-2 py-1.5 font-medium"
      >
        <button
          type="button"
          onClick={() => toggleSort(col)}
          aria-label={`Sort by ${label}`}
          className="inline-flex items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          {label}
          {active &&
            (sort.dir === 1 ? (
              <CaretUpIcon className="size-3" aria-hidden />
            ) : (
              <CaretDownIcon className="size-3" aria-hidden />
            ))}
        </button>
      </th>
    )
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLTableSectionElement>) => {
    if (keys.length === 0) return
    const idx = activeKey ? keys.indexOf(activeKey) : -1

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
      e.preventDefault()
      setSelected(new Set(keys))
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        moveFocus(idx + 1, e.shiftKey)
        break
      case "ArrowUp":
        e.preventDefault()
        moveFocus(idx - 1, e.shiftKey)
        break
      case "Home":
        e.preventDefault()
        moveFocus(0, e.shiftKey)
        break
      case "End":
        e.preventDefault()
        moveFocus(keys.length - 1, e.shiftKey)
        break
      case " ":
        e.preventDefault()
        if (activeKey) {
          toggleOne(activeKey)
          setAnchorKey(activeKey)
        }
        break
      case "Enter":
        if (activeKey) {
          e.preventDefault()
          navigate({ name: "mig", key: activeKey })
        }
        break
      case "Delete":
      case "Backspace":
        e.preventDefault()
        if (selected.size > 0 || activeKey) setDeleteOpen(true)
        break
      case "Escape":
        setSelected(new Set())
        break
    }
  }

  // Targets for delete: the selection, or the focused row if nothing is selected.
  const deleteTargets =
    selected.size > 0 ? [...selected] : activeKey ? [activeKey] : []

  const confirmDelete = async () => {
    setDeleteOpen(false)
    // Soft delete: move the targets (with their history) to the Trash, where they
    // can be restored or permanently deleted.
    const now = Date.now()
    await Promise.all(deleteTargets.map((key) => trashMig(key, now)))
    setSelected(new Set())
    refresh()
  }

  // Compare needs exactly two MIGs of the same message family (same short code) —
  // a cross-message diff is meaningless. Same family covers different versions.
  const sameFamily =
    selectedMigs.length === 2 &&
    shortCodeForIdentifier(selectedMigs[0].messageIdentifier) ===
      shortCodeForIdentifier(selectedMigs[1].messageIdentifier)
  const compareDisabled = !sameFamily
  const compareHint =
    selectedMigs.length !== 2
      ? "Select exactly two MIGs to compare"
      : !sameFamily
        ? "Select two MIGs of the same message to compare"
        : undefined
  const onCompare = () => {
    if (selectedMigs.length !== 2) return
    navigate({
      name: "compare",
      a: getMigKey(selectedMigs[0]),
      b: getMigKey(selectedMigs[1]),
    })
  }

  const hiddenFileInput = (
    <input
      ref={inputRef}
      type="file"
      accept=".yaml,.yml"
      multiple
      aria-label="MIG YAML file"
      className="sr-only"
      onChange={(e) => {
        if (e.target.files?.length) void handleFiles(e.target.files)
        e.target.value = ""
      }}
    />
  )

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-base font-semibold tracking-tight">Message Implementation Guides</h1>
        <Button variant="outline" size="sm" asChild>
          <a href={hashFor({ name: "trash" })}>
            <TrashIcon data-icon="inline-start" aria-hidden />
            Trash{trashCount > 0 ? ` (${trashCount})` : ""}
          </a>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={hashFor({ name: "browse" })}>
            <TreeStructureIcon data-icon="inline-start" aria-hidden />
            Browse e-Repository
          </a>
        </Button>
        <Button size="sm" onClick={() => inputRef.current?.click()}>
          <UploadSimpleIcon data-icon="inline-start" aria-hidden />
          Upload MIG
        </Button>
        {hiddenFileInput}
      </div>

      {importErrors.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <WarningIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Some entries couldn’t be imported:</p>
            <ul className="mt-1 list-disc pl-4">
              {importErrors.map((error, i) => (
                <li key={i} className="break-words">
                  {error}
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={() => setImportErrors([])}
            aria-label="Dismiss import errors"
            className="rounded-sm p-0.5 outline-none hover:bg-destructive/15 focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <XIcon className="size-3.5" aria-hidden />
          </button>
        </div>
      )}

      {migs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No MIGs yet. Upload a MIG YAML, or{" "}
          <a
            href={hashFor({ name: "browse" })}
            className="text-primary underline-offset-4 hover:underline"
          >
            browse the e-Repository
          </a>{" "}
          to create one.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className="mr-auto text-xs text-muted-foreground" aria-live="polite">
              {selected.size > 0 ? `${selected.size} selected` : `${migs.length} MIGs`}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={selected.size === 0}
              onClick={() => downloadMigs(selectedMigs)}
            >
              <DownloadSimpleIcon data-icon="inline-start" aria-hidden />
              Download
            </Button>
            {/* Wrapper carries the hint: a disabled button doesn't fire hover. */}
            <span title={compareHint} className="inline-flex">
              <Button
                variant="outline"
                size="sm"
                disabled={compareDisabled}
                onClick={onCompare}
              >
                <GitDiffIcon data-icon="inline-start" aria-hidden />
                Compare
              </Button>
            </span>
            <Button
              variant="destructive"
              size="sm"
              disabled={selected.size === 0}
              onClick={() => setDeleteOpen(true)}
            >
              <TrashIcon data-icon="inline-start" aria-hidden />
              Delete
            </Button>
          </div>

          <table
            role="grid"
            aria-multiselectable="true"
            aria-label="Stored MIGs"
            className="w-full border-separate border-spacing-0 text-sm"
          >
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="w-8 border-b border-border px-2 py-1.5">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    aria-label="Select all"
                    checked={migs.length > 0 && selected.size === migs.length}
                    onChange={toggleAll}
                  />
                </th>
                {sortHeader("name", "Name")}
                {sortHeader("version", "Version")}
                {sortHeader("message", "Message")}
                {sortHeader("modified", "Last modified")}
              </tr>
            </thead>
            <tbody onKeyDown={onKeyDown}>
              {sortedMigs.map((mig) => {
                const key = getMigKey(mig)
                const isSelected = selected.has(key)
                return (
                  <tr
                    key={key}
                    role="row"
                    aria-selected={isSelected}
                    tabIndex={activeKey === key ? 0 : -1}
                    ref={(el) => {
                      if (el) rowRefs.current.set(key, el)
                      else rowRefs.current.delete(key)
                    }}
                    onFocus={() => setFocusedKey(key)}
                    className="outline-none data-[selected=true]:bg-muted/60 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-inset"
                    data-selected={isSelected}
                  >
                    <td className="border-b border-border px-2 py-1.5">
                      <input
                        type="checkbox"
                        tabIndex={-1}
                        aria-label={`Select ${mig.name} ${mig.version}`}
                        checked={isSelected}
                        onChange={() => toggleOne(key)}
                      />
                    </td>
                    <td className="border-b border-border px-2 py-1.5">
                      <a
                        href={hashFor({ name: "mig", key })}
                        tabIndex={-1}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {mig.name}
                      </a>
                    </td>
                    <td className="border-b border-border px-2 py-1.5">{mig.version}</td>
                    <td className="border-b border-border px-2 py-1.5 text-muted-foreground">
                      {mig.messageIdentifier}
                    </td>
                    <td className="border-b border-border px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                      {lastModified[key] !== undefined ? formatLocalDateTime(lastModified[key]) : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <WarningIcon className="size-3.5 shrink-0" aria-hidden />
            MIGs are stored only in this browser.
            <button
              type="button"
              onClick={() => void downloadMigs(migs)}
              className="rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              Back up all
            </button>
            regularly — clearing browser data deletes them.
          </p>
        </>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${deleteTargets.length} MIG${deleteTargets.length === 1 ? "" : "s"}?`}
        description="They move to the Trash (with their revision history), where you can restore or permanently delete them."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />

      <ImportDuplicateDialog
        open={pendingImport !== null}
        onOpenChange={(open) => {
          if (!open) setPendingImport(null)
        }}
        duplicates={
          pendingImport
            ? pendingImport.incoming
                .filter((m) => pendingImport.duplicateKeys.has(getMigKey(m)))
                .map((m) => `${m.name} ${m.version}`)
            : []
        }
        onResolve={resolvePendingImport}
        onMerge={mergeCandidate ? mergePendingImport : undefined}
      />
    </div>
  )
}
