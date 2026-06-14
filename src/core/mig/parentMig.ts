import { getMigKey } from "./migKey"
import type { MessageImplementationGuide } from "@/core/types/types"

type MigIdentity = Pick<
  MessageImplementationGuide,
  "name" | "version" | "messageIdentifier"
>

/**
 * Eligible parents for `current`: other stored MIGs that target the **same
 * message** and whose selection would not create a cycle.
 * A candidate is rejected when it already descends from `current` — making it
 * the parent would close a loop.
 */
export function eligibleParents(
  all: MessageImplementationGuide[],
  current: MigIdentity
): MessageImplementationGuide[] {
  const currentKey = getMigKey(current)
  const byKey = new Map(all.map((m) => [getMigKey(m), m]))

  // Does `m` reach `current` by following parent links? (cycle if so)
  const descendsFromCurrent = (m: MessageImplementationGuide): boolean => {
    const seen = new Set<string>()
    let cursor = m.parentMIG
    while (cursor && !seen.has(cursor)) {
      if (cursor === currentKey) return true
      seen.add(cursor)
      cursor = byKey.get(cursor)?.parentMIG
    }
    return false
  }

  return all.filter(
    (m) =>
      getMigKey(m) !== currentKey &&
      m.messageIdentifier === current.messageIdentifier &&
      !descendsFromCurrent(m)
  )
}
