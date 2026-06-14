import type { MessageElement } from "@/core/types/types"

/**
 * The absolute xmlPath of a message's root element — a leading slash followed by
 * the root's xmlTag (e.g. `/Document`). xmlPaths are stored absolute; every tree
 * walk seeds from here and appends `/${child.xmlTag}`, so override keys and the
 * paths shown in the UI are one and the same.
 */
export function rootPath(root: MessageElement): string {
  return "/" + root.xmlTag
}

/**
 * Resolve an element by its xmlPath (a leading slash, then slash-joined xmlTags
 * rooted at the message root), or `null` when the path isn't present in this
 * message version. Used to tell whether an override's path actually exists in a
 * given flavour/version.
 */
export function elementAtPath(
  root: MessageElement,
  path: string
): MessageElement | null {
  // Absolute paths begin with "/", so the split yields an empty first segment.
  const segments = path.split("/")
  const start = segments[0] === "" ? 1 : 0
  if (segments[start] !== root.xmlTag) return null
  let current = root
  for (let i = start + 1; i < segments.length; i++) {
    const next = current.elements.find((c) => c.xmlTag === segments[i])
    if (!next) return null
    current = next
  }
  return current
}
