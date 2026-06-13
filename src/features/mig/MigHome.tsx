import { useCallback, useEffect, useRef, useState } from "react"
import { UploadSimple } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { getMigKey } from "@/core/mig/migKey"
import { loadAllMigs, saveMig } from "@/core/storage/migStore"
import type { MessageImplementationGuide } from "@/core/types/types"
import { hashFor } from "@/app/routes"
import { parseMigYaml } from "./parseMigYaml"

export function MigHome() {
  const [migs, setMigs] = useState<MessageImplementationGuide[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(() => {
    loadAllMigs()
      .then(setMigs)
      .catch((err) => console.error("Failed to load MIGs:", err))
  }, [])

  useEffect(refresh, [refresh])

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

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-base font-semibold tracking-tight">Your MIGs</h1>
        <Button size="sm" onClick={() => inputRef.current?.click()}>
          <UploadSimple data-icon="inline-start" aria-hidden />
          Upload MIG
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".yaml,.yml"
          multiple
          aria-label="MIG YAML file"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files)
            e.target.value = "" // allow re-selecting the same file
          }}
        />
      </div>

      {migs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No MIGs yet. Upload a MIG YAML, or{" "}
          <a
            href={hashFor({ name: "browse" })}
            className="text-primary underline-offset-4 hover:underline"
          >
            browse the e-Repository
          </a>
          .
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {migs.map((mig) => {
            const key = getMigKey(mig)
            return (
              <li key={key}>
                <a
                  href={hashFor({ name: "mig", key })}
                  className="flex items-center gap-2 px-3 py-2 text-sm no-underline outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  <span className="font-medium">{mig.name}</span>
                  <code className="rounded-sm bg-muted px-1 text-[0.625rem] text-muted-foreground">
                    {mig.version}
                  </code>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {mig.messageIdentifier}
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
