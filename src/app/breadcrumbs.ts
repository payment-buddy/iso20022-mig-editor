import type { Route } from "./routes"

export interface Crumb {
  label: string
  /** Target route; omitted for the current (last) crumb, which is not a link. */
  route?: Route
}

/**
 * Breadcrumb trail derived from the route. Labels for messages/MIGs are the
 * raw code/key for now; later phases enrich them with human names.
 */
export function breadcrumbsFor(route: Route): Crumb[] {
  const home: Crumb = { label: "Home", route: { name: "home" } }

  switch (route.name) {
    case "home":
      return [{ label: "Home" }]
    case "browse":
      return [home, { label: "e-Repository" }]
    case "message":
      return [home, { label: "e-Repository", route: { name: "browse" } }, { label: route.code }]
    case "mig":
      return [home, { label: route.key }]
    case "compare":
      return [home, { label: `Compare: ${route.a} ↔ ${route.b}` }]
  }
}
