/**
 * The message-family "short code" — the first two dot-segments of an ISO 20022
 * message identifier, e.g. `pacs.008.001.08` → `pacs.008`. This mirrors how the
 * e-Repository parser builds `MessageDefinition.shortCode` (businessArea +
 * messageFunctionality), but derives it from the identifier string so it works
 * on a MIG's `messageIdentifier` without the repository loaded. Two MIGs share a
 * short code when they implement the same message family (any flavour/version).
 */
export function shortCodeForIdentifier(identifier: string): string {
  return identifier.split(".").slice(0, 2).join(".")
}
