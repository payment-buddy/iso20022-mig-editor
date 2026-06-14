import { cn } from "@/lib/utils"

/**
 * The shared override-provenance glyph: a filled **circle** in blue for a value
 * overridden in this MIG (`"own"`), or a filled **diamond** in violet for one
 * inherited from a parent MIG (`"inherited"`). Shape *and* colour carry the
 * meaning so colour isn't the only cue (WCAG 1.4.1). Colours come from the
 * shared `--color-provenance-*` theme variables.
 */
export function ProvenanceMarker({
  provenance,
  label,
  className,
}: {
  provenance: "own" | "inherited"
  /** Sets `title` + `aria-label`; omit for a decorative (`aria-hidden`) marker. */
  label?: string
  className?: string
}) {
  return (
    <span
      title={label}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "size-1.5 shrink-0",
        provenance === "own" && "rounded-full bg-provenance-own",
        provenance === "inherited" &&
          "rotate-45 scale-[0.85] bg-provenance-inherited",
        className
      )}
    />
  )
}
