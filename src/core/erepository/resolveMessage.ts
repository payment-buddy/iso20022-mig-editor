import type { BusinessArea, ERepository, MessageDefinition } from "@/core/types/types"

export interface ResolvedMessage {
  area: BusinessArea
  current: MessageDefinition
  /** All versions sharing the message's shortCode, ascending by identifier. */
  versions: MessageDefinition[]
}

const byIdentifier = (a: MessageDefinition, b: MessageDefinition) =>
  a.identifier.localeCompare(b.identifier)

/**
 * Resolve a route code to a message. An exact `identifier` selects that version;
 * otherwise a `shortCode` selects the latest version of that family.
 */
export function resolveMessage(repo: ERepository, code: string): ResolvedMessage | null {
  for (const area of repo.businessAreas) {
    const current = area.messages.find((m) => m.identifier === code)
    if (current) {
      const versions = area.messages
        .filter((m) => m.shortCode === current.shortCode)
        .sort(byIdentifier)
      return { area, current, versions }
    }
  }

  for (const area of repo.businessAreas) {
    const versions = area.messages.filter((m) => m.shortCode === code).sort(byIdentifier)
    if (versions.length > 0) {
      return { area, current: versions[versions.length - 1], versions }
    }
  }

  return null
}
