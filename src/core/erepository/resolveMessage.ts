import { buildCodeListResolver, enrichMessageDsl } from "@/core/mig/expression"
import type {
  BusinessArea,
  ERepository,
  MessageDefinition,
} from "@/core/types/types"

export interface ResolvedMessage {
  area: BusinessArea
  current: MessageDefinition
  /** All versions sharing the message's shortCode, ascending by identifier. */
  versions: MessageDefinition[]
}

const byIdentifier = (a: MessageDefinition, b: MessageDefinition) =>
  a.identifier.localeCompare(b.identifier)

// Messages whose constraints' DSL has already been derived from their raw ISO
// expressions — so the (idempotent, in-place) transpile runs at most once per
// message, not on every resolve/render.
const dslEnriched = new WeakSet<MessageDefinition>()

// The code-set resolver depends only on the repository, but building it indexes
// every code set (~4000), so cache it per `ERepository` rather than rebuilding on
// the first resolve of each message.
const resolverByRepo = new WeakMap<
  ERepository,
  ReturnType<typeof buildCodeListResolver>
>()

function codeListResolver(
  repo: ERepository
): ReturnType<typeof buildCodeListResolver> {
  let resolve = resolverByRepo.get(repo)
  if (!resolve) {
    resolve = buildCodeListResolver(repo.codeSets ?? [])
    resolverByRepo.set(repo, resolve)
  }
  return resolve
}

/** Derive each standard constraint's DSL `expression` from its raw ISO blob, once. */
function ensureDsl(repo: ERepository, message: MessageDefinition): void {
  if (dslEnriched.has(message)) return
  enrichMessageDsl(message, codeListResolver(repo))
  dslEnriched.add(message)
}

/**
 * Resolve a route code to a message. An exact `identifier` selects that version;
 * otherwise a `shortCode` selects the latest version of that family.
 */
export function resolveMessage(
  repo: ERepository,
  code: string
): ResolvedMessage | null {
  for (const area of repo.businessAreas) {
    const current = area.messages.find((m) => m.identifier === code)
    if (current) {
      const versions = area.messages
        .filter((m) => m.shortCode === current.shortCode)
        .sort(byIdentifier)
      ensureDsl(repo, current)
      return { area, current, versions }
    }
  }

  for (const area of repo.businessAreas) {
    const versions = area.messages
      .filter((m) => m.shortCode === code)
      .sort(byIdentifier)
    if (versions.length > 0) {
      const current = versions[versions.length - 1]
      ensureDsl(repo, current)
      return { area, current, versions }
    }
  }

  return null
}
