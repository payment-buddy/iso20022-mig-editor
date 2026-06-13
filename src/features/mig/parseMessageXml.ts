import type { InstanceNode } from "@/core/mig/validateInstance"

/** Convert a DOM element to the framework-agnostic InstanceNode the validator wants. */
function toInstanceNode(el: Element): InstanceNode {
  const attributes: Record<string, string> = {}
  for (const attr of Array.from(el.attributes)) {
    if (attr.name === "xmlns" || attr.name.startsWith("xmlns:")) continue
    attributes[attr.localName] = attr.value
  }
  const children: InstanceNode[] = []
  let text = ""
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 1) children.push(toInstanceNode(child as Element)) // ELEMENT_NODE
    else if (child.nodeType === 3) text += child.textContent ?? "" // TEXT_NODE
  }
  return { localName: el.localName, attributes, text, children }
}

/**
 * Parse a message-instance XML string into an {@link InstanceNode} tree (namespace
 * prefixes stripped), or an error message when the XML is malformed/empty.
 */
export function parseMessageXml(xml: string): { root: InstanceNode } | { error: string } {
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(xml, "application/xml")
  } catch {
    return { error: "Could not parse the XML." }
  }
  const parseError = doc.querySelector("parsererror")
  if (parseError) return { error: parseError.textContent?.trim() || "Invalid XML." }
  const root = doc.documentElement
  if (!root) return { error: "The document is empty." }
  return { root: toInstanceNode(root) }
}
