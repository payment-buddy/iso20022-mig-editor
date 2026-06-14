/**
 * Provenance marker for an override field: a primary (blue) dot when the value is
 * overridden in this MIG, a violet dot when it's inherited from a parent MIG, and
 * nothing for an unmarked original. The dot colours match the element-tree tints.
 * `baseline` is shown in the tooltip (the value that a reset would restore).
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
    const label = `Overridden — inherited: ${baseline}`
    return (
      <span
        title={label}
        aria-label={label}
        className="size-1.5 shrink-0 cursor-help rounded-full bg-primary"
      />
    )
  }
  if (inherited) {
    const label = `Inherited from a parent MIG: ${baseline}`
    return (
      <span
        title={label}
        aria-label={label}
        className="size-1.5 shrink-0 cursor-help rounded-full bg-violet-600 dark:bg-violet-400"
      />
    )
  }
  return null
}
