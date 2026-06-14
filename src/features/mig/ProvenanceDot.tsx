import { ProvenanceMarker } from "@/components/ProvenanceMarker"

/**
 * Provenance marker for an override field — a thin wrapper around
 * {@link ProvenanceMarker} that adds the field-level affordances: a tooltip /
 * `aria-label` describing the provenance, a help cursor, and rendering nothing
 * for an unmarked original. `baseline` (the value a reset would restore) is
 * shown in the tooltip.
 */
export function ProvenanceDot({
  overridden,
  inherited = false,
  baseline,
}: {
  overridden: boolean
  inherited?: boolean
  baseline: string
}) {
  if (overridden) {
    return (
      <ProvenanceMarker
        provenance="own"
        label={`Overridden — inherited: ${baseline}`}
        className="cursor-help"
      />
    )
  }
  if (inherited) {
    return (
      <ProvenanceMarker
        provenance="inherited"
        label={`Inherited from a parent MIG: ${baseline}`}
        className="cursor-help"
      />
    )
  }
  return null
}
