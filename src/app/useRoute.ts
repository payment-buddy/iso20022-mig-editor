import { useEffect, useState } from "react"
import { parseHash, type Route } from "./routes"

/** Current route, kept in sync with `location.hash`. */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    parseHash(window.location.hash)
  )
  useEffect(() => {
    const handler = () => setRoute(parseHash(window.location.hash))
    window.addEventListener("hashchange", handler)
    return () => window.removeEventListener("hashchange", handler)
  }, [])
  return route
}
