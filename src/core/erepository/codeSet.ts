import type { MessageElement } from "@/core/types/types"

/**
 * ISO 20022 "external" code sets are open-ended: the repository carries only a
 * current snapshot of codes, while the authoritative list is published and
 * maintained separately (the "External Code Sets" spreadsheet) and may be
 * extended between releases. By Registration Authority convention every such set
 * is named with the `External` prefix (e.g. `ExternalPurpose1Code`).
 *
 * The practical consequence: a MIG may legitimately list `allowedValues` beyond
 * the snapshot, so adding values outside the standard set is *not* an
 * inconsistency for these elements.
 */
export function isExternalCodeSet(element: MessageElement): boolean {
  return element.baseType === "CodeSet" && element.type.startsWith("External")
}
