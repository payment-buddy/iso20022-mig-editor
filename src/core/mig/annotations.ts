import type {
  ElementOverrides,
  MessageImplementationGuide,
} from "@/core/types/types"

// Annotations are MIG-level custom properties. Elements and constraints carry
// independent sets: their names are declared once and shared
// (`elementAnnotationNames` / `constraintAnnotationNames`), and each element
// override (resp. additional constraint) carries a value per name
// (`annotations`). These immutable helpers keep the declared-name lists and the
// per-target values in sync.

/** Declare a new annotation name (trimmed, de-duplicated). */
export function addAnnotation(
  mig: MessageImplementationGuide,
  name: string
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
  name: string
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

/** Declare a new constraint-annotation name (trimmed, de-duplicated). */
export function addConstraintAnnotation(
  mig: MessageImplementationGuide,
  name: string
): MessageImplementationGuide {
  const trimmed = name.trim()
  const names = mig.constraintAnnotationNames ?? []
  if (!trimmed || names.includes(trimmed)) return mig
  return { ...mig, constraintAnnotationNames: [...names, trimmed] }
}

/** Strip `name` from one constraint-annotation map, returning a new map (or undefined when emptied). */
function stripAnnotation(
  annotations: Record<string, string | null> | undefined,
  name: string
): Record<string, string | null> | undefined {
  if (!annotations || !(name in annotations)) return annotations
  const next = { ...annotations }
  delete next[name]
  return Object.keys(next).length === 0 ? undefined : next
}

/**
 * Remove a constraint-annotation name and strip its value from every additional
 * constraint **and** constraint-override overlay (pruning a now-empty
 * `annotations` map, and an override entry that empties with it). The names list
 * is dropped entirely when it becomes empty. The constraints/overlays themselves
 * are left in place — only the annotation value is removed.
 */
export function removeConstraintAnnotation(
  mig: MessageImplementationGuide,
  name: string
): MessageImplementationGuide {
  const names = (mig.constraintAnnotationNames ?? []).filter((n) => n !== name)

  const elementOverrides: ElementOverrides = {}
  for (const [path, override] of Object.entries(mig.elementOverrides)) {
    let next = override

    const acMap = override.additionalConstraints
    if (
      acMap &&
      Object.values(acMap).some((c) => c.annotations && name in c.annotations)
    ) {
      const additionalConstraints: typeof acMap = {}
      for (const [cname, c] of Object.entries(acMap)) {
        const annotations = stripAnnotation(c.annotations, name)
        if (annotations === c.annotations) {
          additionalConstraints[cname] = c
          continue
        }
        const updated = { ...c }
        if (annotations) updated.annotations = annotations
        else delete updated.annotations
        additionalConstraints[cname] = updated
      }
      next = { ...next, additionalConstraints }
    }

    const coMap = override.constraintOverrides
    if (
      coMap &&
      Object.values(coMap).some((o) => o.annotations && name in o.annotations)
    ) {
      const constraintOverrides: typeof coMap = {}
      for (const [cname, o] of Object.entries(coMap)) {
        const annotations = stripAnnotation(o.annotations, name)
        if (annotations === o.annotations) {
          constraintOverrides[cname] = o
          continue
        }
        const updated = { ...o }
        if (annotations) updated.annotations = annotations
        else delete updated.annotations
        // An overlay whose only purpose was this annotation is now empty — drop it.
        if (Object.keys(updated).length > 0) constraintOverrides[cname] = updated
      }
      next =
        Object.keys(constraintOverrides).length > 0
          ? { ...next, constraintOverrides }
          : (() => {
              const n = { ...next }
              delete n.constraintOverrides
              return n
            })()
    }

    // Prune an override left empty (e.g. its only field was the dropped overlay).
    if (Object.keys(next).length > 0) elementOverrides[path] = next
  }

  const result: MessageImplementationGuide = { ...mig, elementOverrides }
  if (names.length === 0) delete result.constraintAnnotationNames
  else result.constraintAnnotationNames = names
  return result
}
