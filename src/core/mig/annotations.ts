import type { ElementOverrides, MessageImplementationGuide } from "@/core/types/types"

// Annotations are MIG-level custom element properties: their names are declared
// once and shared (`elementAnnotationNames`), and each element override
// carries a value per name (`annotations`). These immutable helpers keep
// the declared-name list and the per-element values in sync.

/** Declare a new annotation name (trimmed, de-duplicated). */
export function addAnnotation(
  mig: MessageImplementationGuide,
  name: string,
): MessageImplementationGuide {
  const trimmed = name.trim()
  const names = mig.elementAnnotationNames ?? []
  if (!trimmed || names.includes(trimmed)) return mig
  return { ...mig, elementAnnotationNames: [...names, trimmed] }
}

/**
 * Remove an annotation name and strip its value from every element override
 * (pruning overrides that become empty). The names list is dropped entirely when
 * it becomes empty.
 */
export function removeAnnotation(
  mig: MessageImplementationGuide,
  name: string,
): MessageImplementationGuide {
  const names = (mig.elementAnnotationNames ?? []).filter((n) => n !== name)

  const elementOverrides: ElementOverrides = {}
  for (const [path, override] of Object.entries(mig.elementOverrides)) {
    let next = override
    if (override.annotations && name in override.annotations) {
      const annotations = { ...override.annotations }
      delete annotations[name]
      next = { ...override }
      if (Object.keys(annotations).length === 0) delete next.annotations
      else next.annotations = annotations
    }
    if (Object.keys(next).length > 0) elementOverrides[path] = next
  }

  const result: MessageImplementationGuide = { ...mig, elementOverrides }
  if (names.length === 0) delete result.elementAnnotationNames
  else result.elementAnnotationNames = names
  return result
}
