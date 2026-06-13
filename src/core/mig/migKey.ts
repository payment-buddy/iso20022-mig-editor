import type { MessageImplementationGuide } from "@/core/types/types"

/** The identity key for a MIG: `name:version`. Stable across the app and IndexedDB. */
export function getMigKey(mig: Pick<MessageImplementationGuide, "name" | "version">): string {
  return `${mig.name}:${mig.version}`
}
