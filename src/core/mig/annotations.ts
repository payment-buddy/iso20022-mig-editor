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

/**
 * Remove a constraint-annotation name and strip its value from every additional
 * constraint (pruning a constraint's `annotations` when it empties). The names
 * list is dropped entirely when it becomes empty. The constraints themselves are
 * left in place — only the annotation value is removed.
 */
export function removeConstraintAnnotation(
  mig: MessageImplementationGuide,
  name: string
): MessageImplementationGuide {
  const names = (mig.constraintAnnotationNames ?? []).filter((n) => n !== name)

  const elementOverrides: ElementOverrides = {}
  for (const [path, override] of Object.entries(mig.elementOverrides)) {
    const list = override.additionalConstraints
    if (list?.some((c) => c.annotations && name in c.annotations)) {
      const additionalConstraints = list.map((c) => {
        if (!c.annotations || !(name in c.annotations)) return c
        const annotations = { ...c.annotations }
        delete annotations[name]
        const next = { ...c }
        if (Object.keys(annotations).length === 0) delete next.annotations
        else next.annotations = annotations
        return next
      })
      elementOverrides[path] = { ...override, additionalConstraints }
    } else {
      elementOverrides[path] = override
    }
  }

  const result: MessageImplementationGuide = { ...mig, elementOverrides }
  if (names.length === 0) delete result.constraintAnnotationNames
  else result.constraintAnnotationNames = names
  return result
}
