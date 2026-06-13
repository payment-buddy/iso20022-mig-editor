// Message-instance validation (IMPLEMENTATION_PLAN Phase 6). Walk a parsed
// message XML against the ISO message definition + the effective MIG, reporting
// cardinality / exclusion / code / length / pattern / inclusive-range / digit
// violations with their schema xmlPath (for tree navigation). Pure — the DOM
// parsing lives in a separate adapter (features/mig/parseMessageXml).

import { createValueValidator } from "./fieldValidation"
import type {
  ElementOverride,
  ElementOverrides,
  MessageDefinition,
  MessageElement,
} from "@/core/types/types"

/** A minimal, framework-agnostic view of a parsed XML element. */
export type InstanceNode = {
  /** Local element name (namespace prefix stripped). */
  localName: string
  /** Attribute values by local name (xmlns declarations excluded). */
  attributes: Record<string, string>
  /** Direct text content (for leaf elements). */
  text: string
  children: InstanceNode[]
}

export type InstanceDiagnostic = {
  /** Schema xmlPath of the element/attribute — used to navigate the tree. */
  path: string
  elementName: string
  message: string
}

/** Effective cardinality of `el` at a path, given its (merged) override. */
function effOccurs(override: ElementOverride | undefined, el: MessageElement) {
  return {
    minOccurs: override && "minOccurs" in override ? (override.minOccurs ?? 0) : el.minOccurs,
    maxOccurs: override && "maxOccurs" in override ? (override.maxOccurs ?? null) : el.maxOccurs,
  }
}

/** Validate one leaf value against the effective facets, returning all violations. */
function leafErrors(
  el: MessageElement,
  override: ElementOverride | undefined,
  value: string,
): string[] {
  const errors: string[] = []

  // Length / pattern / digits via the shared validator.
  const facet = createValueValidator(el, override)(value)
  if (facet) errors.push(facet)

  // Allowed codes / values (the MIG-restricted list, else the ISO code set).
  const codes =
    override && "allowedValues" in override
      ? (override.allowedValues ?? [])
      : el.codes.map((c) => c.codeName)
  if (codes.length > 0 && !codes.includes(value)) {
    errors.push(`"${value}" is not an allowed value.`)
  }

  // Inclusive range.
  const minIncl = override && "minInclusive" in override ? override.minInclusive : el.minInclusive
  const maxIncl = override && "maxInclusive" in override ? override.maxInclusive : el.maxInclusive
  if (minIncl != null || maxIncl != null) {
    const n = Number(value)
    if (Number.isFinite(n)) {
      if (minIncl != null && n < minIncl) errors.push(`${value} is below the minimum ${minIncl}.`)
      if (maxIncl != null && n > maxIncl) errors.push(`${value} is above the maximum ${maxIncl}.`)
    }
  }

  return errors
}

function walk(
  el: MessageElement,
  node: InstanceNode,
  path: string,
  overrides: ElementOverrides,
  out: InstanceDiagnostic[],
) {
  // Leaf value (simple types carry a value; complex containers don't).
  if (el.baseType !== null) {
    for (const message of leafErrors(el, overrides[path], node.text.trim())) {
      out.push({ path, elementName: el.name, message })
    }
  }

  const elementTags = new Set<string>()
  for (const child of el.elements) {
    const childPath = `${path}/${child.xmlTag}`
    const override = overrides[childPath]
    const { minOccurs, maxOccurs } = effOccurs(override, child)

    if (child.isAttribute) {
      const present = child.xmlTag in node.attributes
      if (maxOccurs === 0 && present) {
        out.push({ path: childPath, elementName: child.name, message: "Excluded by the MIG but present." })
      } else if (!present && minOccurs >= 1) {
        out.push({ path: childPath, elementName: child.name, message: "Required attribute is missing." })
      } else if (present && child.baseType !== null) {
        for (const message of leafErrors(child, override, node.attributes[child.xmlTag])) {
          out.push({ path: childPath, elementName: child.name, message })
        }
      }
      continue
    }

    elementTags.add(child.xmlTag)
    const instances = node.children.filter((c) => c.localName === child.xmlTag)
    const count = instances.length
    if (maxOccurs === 0) {
      if (count > 0) {
        out.push({
          path: childPath,
          elementName: child.name,
          message: `Excluded by the MIG but appears ${count} time(s).`,
        })
      }
    } else {
      if (count < minOccurs) {
        out.push({
          path: childPath,
          elementName: child.name,
          message: `Appears ${count} time(s); minimum is ${minOccurs}.`,
        })
      }
      if (maxOccurs !== null && count > maxOccurs) {
        out.push({
          path: childPath,
          elementName: child.name,
          message: `Appears ${count} time(s); maximum is ${maxOccurs}.`,
        })
      }
    }
    for (const inst of instances) walk(child, inst, childPath, overrides, out)
  }

  // Elements present in the instance that the message definition doesn't declare.
  for (const child of node.children) {
    if (!elementTags.has(child.localName)) {
      out.push({ path, elementName: el.name, message: `Unexpected element <${child.localName}>.` })
    }
  }
}

/**
 * Validate a parsed message instance against the ISO message and the effective
 * MIG overrides (own + inherited). Returns violations in document order, each
 * tagged with the schema xmlPath of the offending element/attribute.
 */
export function validateMessageInstance(
  root: InstanceNode,
  message: MessageDefinition,
  effectiveOverrides: ElementOverrides,
): InstanceDiagnostic[] {
  const out: InstanceDiagnostic[] = []
  const rootEl = message.rootElement
  if (root.localName !== rootEl.xmlTag) {
    out.push({
      path: rootEl.xmlTag,
      elementName: rootEl.name,
      message: `Root <${root.localName}> does not match the message root <${rootEl.xmlTag}>.`,
    })
    return out
  }
  walk(rootEl, root, rootEl.xmlTag, effectiveOverrides, out)
  return out
}
