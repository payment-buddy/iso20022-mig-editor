import type { ElementOverrides, MessageImplementationGuide } from "@/core/types/types"

// MIG-level custom **element** property names are declared once and shared; each
// element override then carries a value per name in `customProperties`. These
// immutable helpers keep the declared-name list and the per-element values in sync.

/** Declare a new custom element property name (trimmed, de-duplicated). */
export function addCustomElementPropertyName(
  mig: MessageImplementationGuide,
  name: string,
): MessageImplementationGuide {
  const trimmed = name.trim()
  const names = mig.customElementPropertyNames ?? []
  if (!trimmed || names.includes(trimmed)) return mig
  return { ...mig, customElementPropertyNames: [...names, trimmed] }
}

/**
 * Remove a custom element property name and strip its value from every element
 * override (pruning overrides that become empty). The names list is dropped
 * entirely when it becomes empty.
 */
export function removeCustomElementPropertyName(
  mig: MessageImplementationGuide,
  name: string,
): MessageImplementationGuide {
  const names = (mig.customElementPropertyNames ?? []).filter((n) => n !== name)

  const elementOverrides: ElementOverrides = {}
  for (const [path, override] of Object.entries(mig.elementOverrides)) {
    let next = override
    if (override.customProperties && name in override.customProperties) {
      const customProperties = { ...override.customProperties }
      delete customProperties[name]
      next = { ...override }
      if (Object.keys(customProperties).length === 0) delete next.customProperties
      else next.customProperties = customProperties
    }
    if (Object.keys(next).length > 0) elementOverrides[path] = next
  }

  const result: MessageImplementationGuide = { ...mig, elementOverrides }
  if (names.length === 0) delete result.customElementPropertyNames
  else result.customElementPropertyNames = names
  return result
}
