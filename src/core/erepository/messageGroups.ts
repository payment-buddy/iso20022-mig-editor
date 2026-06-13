import type { MessageDefinition } from "@/core/types/types"

/** A family of message versions sharing a `shortCode` (e.g. all pacs.008 versions). */
export interface MessageGroup {
  /** Canonical group key; also the value the explorer routes on (`#<shortCode>`). */
  shortCode: string
  /** Display label: the base name with its trailing version suffix (`V\d+`) stripped. */
  label: string
  /** Versions in the family, sorted ascending by version number. */
  versions: MessageDefinition[]
}

/** Strip a trailing `V\d+` version suffix from a message name. */
export function baseName(name: string): string {
  return name.replace(/V\d+$/, "")
}

function versionNumber(name: string): number {
  return Number(name.match(/V(\d+)$/)?.[1] ?? 0)
}

/**
 * Group an area's messages by `shortCode` (the value the explorer routes on),
 * each group's versions sorted ascending, groups sorted by `shortCode`.
 */
export function groupMessages(messages: MessageDefinition[]): MessageGroup[] {
  const map = new Map<string, MessageDefinition[]>()
  for (const msg of messages) {
    const existing = map.get(msg.shortCode)
    if (existing) existing.push(msg)
    else map.set(msg.shortCode, [msg])
  }

  const groups: MessageGroup[] = []
  for (const [shortCode, versions] of map) {
    const sorted = versions
      .slice()
      .sort((a, b) => versionNumber(a.name) - versionNumber(b.name))
    groups.push({ shortCode, label: baseName(sorted[0].name), versions: sorted })
  }
  return groups.sort((a, b) => a.shortCode.localeCompare(b.shortCode))
}
