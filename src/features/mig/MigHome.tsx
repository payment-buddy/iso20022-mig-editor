import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react"
import { DownloadSimple, GitDiff, Trash, TreeStructure, UploadSimple } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { getMigKey } from "@/core/mig/migKey"
import { deleteMig, loadAllMigs, saveMig } from "@/core/storage/migStore"
import type { MessageImplementationGuide } from "@/core/types/types"
import { hashFor, navigate } from "@/app/routes"
import { parseMigYaml } from "./parseMigYaml"
import { downloadMigs } from "./downloadMigs"

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

function keysBetween(keys: string[], a: string, b: string): string[] {
  const i = keys.indexOf(a)
  const j = keys.indexOf(b)
  if (i < 0 || j < 0) return []
  return i <= j ? keys.slice(i, j + 1) : keys.slice(j, i + 1)
}

export function MigHome() {
  const [migs, setMigs] = useState<MessageImplementationGuide[]>([])
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const [anchorKey, setAnchorKey] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const selectAllRef = useRef<HTMLInputElement>(null)
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>())

  const keys = migs.map(getMigKey)
  const activeKey = focusedKey && keys.includes(focusedKey) ? focusedKey : (keys[0] ?? null)
  const selectedMigs = migs.filter((m) => selected.has(getMigKey(m)))

  const refresh = useCallback(() => {
    loadAllMigs()
      .then((loaded) => {
        loaded.sort((a, b) => getMigKey(a).localeCompare(getMigKey(b)))
        setMigs(loaded)
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

  const handleFiles = useCallback(
    async (files: FileList) => {
      for (const file of Array.from(files)) {
        const text = await file.text()
        await Promise.all(parseMigYaml(text).map(saveMig))
      }
      refresh()
    },
    [refresh],
  )

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
    await Promise.all(deleteTargets.map(deleteMig))
    setSelected(new Set())
    refresh()
  }

  const compareDisabled = selected.size !== 2
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
        <h1 className="mr-auto text-base font-semibold tracking-tight">Your MIGs</h1>
        <Button variant="outline" size="sm" asChild>
          <a href={hashFor({ name: "browse" })}>
            <TreeStructure data-icon="inline-start" aria-hidden />
            Browse e-Repository
          </a>
        </Button>
        <Button size="sm" onClick={() => inputRef.current?.click()}>
          <UploadSimple data-icon="inline-start" aria-hidden />
          Upload MIG
        </Button>
        {hiddenFileInput}
      </div>

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
              <DownloadSimple data-icon="inline-start" aria-hidden />
              Download
            </Button>
            <Button variant="outline" size="sm" disabled={compareDisabled} onClick={onCompare}>
              <GitDiff data-icon="inline-start" aria-hidden />
              Compare
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={selected.size === 0}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash data-icon="inline-start" aria-hidden />
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
                <th scope="col" className="border-b border-border px-2 py-1.5 font-medium">
                  Name
                </th>
                <th scope="col" className="border-b border-border px-2 py-1.5 font-medium">
                  Version
                </th>
                <th scope="col" className="border-b border-border px-2 py-1.5 font-medium">
                  Message
                </th>
              </tr>
            </thead>
            <tbody onKeyDown={onKeyDown}>
              {migs.map((mig) => {
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
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${deleteTargets.length} MIG${deleteTargets.length === 1 ? "" : "s"}?`}
        description="This permanently removes the selected MIG(s) from this browser. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  )
}
