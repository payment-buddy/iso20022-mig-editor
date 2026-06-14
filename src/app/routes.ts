// Typed hash-router model. No dependency — the whole app has ~5 routes
// (FUNCTIONALITY.md §4). The hash is the single source of truth.

export type Route =
  | { name: "home" } // MIG list
  | { name: "browse" } // business-area / message browser
  | { name: "message"; code: string } // read-only explorer (#<shortCode|identifier>)
  | { name: "mig"; key: string } // editor (#mig/<name:version>)
  | { name: "history"; key: string } // revision history (#history/<name:version>)
  | { name: "compare"; a: string; b: string } // compare two MIGs
  | { name: "merge"; key: string } // merge an uploaded MIG into this one (#merge/<name:version>)
  | { name: "trash" } // soft-deleted MIGs (#trash)

const MIG_PREFIX = "mig/"
const HISTORY_PREFIX = "history/"
const COMPARE_PREFIX = "compare/"
const MERGE_PREFIX = "merge/"

/** Parse a raw `location.hash` (with or without the leading `#`) into a Route. */
export function parseHash(hash: string): Route {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash

  if (raw === "" || raw === "/") return { name: "home" }
  if (raw === "browse") return { name: "browse" }
  if (raw === "trash") return { name: "trash" }

  if (raw.startsWith(MIG_PREFIX)) {
    const key = decodeURIComponent(raw.slice(MIG_PREFIX.length))
    return key ? { name: "mig", key } : { name: "home" }
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
  return { name: "message", code: decodeURIComponent(raw) }
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
      return "#" + encodeURIComponent(route.code)
    case "mig":
      return "#" + MIG_PREFIX + encodeURIComponent(route.key)
    case "history":
      return "#" + HISTORY_PREFIX + encodeURIComponent(route.key)
    case "compare":
      return "#" + COMPARE_PREFIX + encodeURIComponent(route.a) + "/" + encodeURIComponent(route.b)
    case "merge":
      return "#" + MERGE_PREFIX + encodeURIComponent(route.key)
  }
}

/** Imperatively navigate — updates `location.hash`, which fires the hashchange listener. */
export function navigate(route: Route): void {
  window.location.hash = hashFor(route)
}
