// Typed hash-router model. No dependency — the whole app has a handful of routes.
// The hash is the single source of truth.

export type Route =
  | { name: "home" } // MIG list
  | { name: "browse" } // business-area / message browser
  // read-only explorer (#<shortCode|identifier>); `path` deep-links an element
  | { name: "message"; code: string; path?: string }
  // editor (#mig/<name:version>); `path` deep-links an element/constraint node
  | { name: "mig"; key: string; path?: string }
  | { name: "history"; key: string } // revision history (#history/<name:version>)
  | { name: "compare"; a: string; b: string } // compare two MIGs
  | { name: "merge"; key: string } // merge an uploaded MIG into this one (#merge/<name:version>)
  | { name: "trash" } // soft-deleted MIGs (#trash)

const MIG_PREFIX = "mig/"
const HISTORY_PREFIX = "history/"
const COMPARE_PREFIX = "compare/"
const MERGE_PREFIX = "merge/"

// An optional `?path=<encoded xmlPath>` suffix on the message/mig routes that
// selects (and scrolls to) an element when the screen mounts — lets a search
// result, and a bookmark, deep-link a specific node. `?` can't appear in the
// (encodeURIComponent'd) code/key before it, so it's an unambiguous delimiter.
const SELECT_PATH_PARAM = "?path="

function splitSelectPath(s: string): { base: string; path?: string } {
  const i = s.indexOf(SELECT_PATH_PARAM)
  if (i === -1) return { base: s }
  const path = decodeURIComponent(s.slice(i + SELECT_PATH_PARAM.length))
  return { base: s.slice(0, i), path: path || undefined }
}

function selectSuffix(path: string | undefined): string {
  return path ? SELECT_PATH_PARAM + encodeURIComponent(path) : ""
}

/** Parse a raw `location.hash` (with or without the leading `#`) into a Route. */
export function parseHash(hash: string): Route {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash

  if (raw === "" || raw === "/") return { name: "home" }
  if (raw === "browse") return { name: "browse" }
  if (raw === "trash") return { name: "trash" }

  if (raw.startsWith(MIG_PREFIX)) {
    const { base, path } = splitSelectPath(raw.slice(MIG_PREFIX.length))
    const key = decodeURIComponent(base)
    if (!key) return { name: "home" }
    return path ? { name: "mig", key, path } : { name: "mig", key }
  }

  if (raw.startsWith(HISTORY_PREFIX)) {
    const key = decodeURIComponent(raw.slice(HISTORY_PREFIX.length))
    return key ? { name: "history", key } : { name: "home" }
  }

  if (raw.startsWith(COMPARE_PREFIX)) {
    const parts = raw.slice(COMPARE_PREFIX.length).split("/")
    if (parts.length === 2 && parts[0] && parts[1]) {
      return {
        name: "compare",
        a: decodeURIComponent(parts[0]),
        b: decodeURIComponent(parts[1]),
      }
    }
    return { name: "home" }
  }

  if (raw.startsWith(MERGE_PREFIX)) {
    const key = decodeURIComponent(raw.slice(MERGE_PREFIX.length))
    return key ? { name: "merge", key } : { name: "home" }
  }

  // Anything else is a message short-code or identifier; the page resolves it
  // against the e-Repository.
  const { base, path } = splitSelectPath(raw)
  const code = decodeURIComponent(base)
  return path ? { name: "message", code, path } : { name: "message", code }
}

/** Serialize a Route to a hash string including the leading `#` (for anchor hrefs). */
export function hashFor(route: Route): string {
  switch (route.name) {
    case "home":
      return "#"
    case "browse":
      return "#browse"
    case "trash":
      return "#trash"
    case "message":
      return "#" + encodeURIComponent(route.code) + selectSuffix(route.path)
    case "mig":
      return (
        "#" +
        MIG_PREFIX +
        encodeURIComponent(route.key) +
        selectSuffix(route.path)
      )
    case "history":
      return "#" + HISTORY_PREFIX + encodeURIComponent(route.key)
    case "compare":
      return (
        "#" +
        COMPARE_PREFIX +
        encodeURIComponent(route.a) +
        "/" +
        encodeURIComponent(route.b)
      )
    case "merge":
      return "#" + MERGE_PREFIX + encodeURIComponent(route.key)
  }
}

/** Imperatively navigate — updates `location.hash`, which fires the hashchange listener. */
export function navigate(route: Route): void {
  window.location.hash = hashFor(route)
}
