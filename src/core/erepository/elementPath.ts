import type { MessageElement } from "@/core/types/types"

/**
 * Resolve an element by its xmlPath (slash-joined xmlTags, rooted at the message
 * root), or `null` when the path isn't present in this message version. Used to
 * tell whether an override's path actually exists in a given flavour/version.
 */
export function elementAtPath(root: MessageElement, path: string): MessageElement | null {
  const segments = path.split("/")
  if (segments[0] !== root.xmlTag) return null
  let current = root
  for (let i = 1; i < segments.length; i++) {
    const next = current.elements.find((c) => c.xmlTag === segments[i])
    if (!next) return null
    current = next
  }
  return current
}
