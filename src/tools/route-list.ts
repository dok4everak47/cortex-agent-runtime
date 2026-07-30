import { runArtisan } from "../mcp.js"

export interface RouteEntry {
  domain: string | null
  method: string
  uri: string
  name: string | null
  action: string
  middleware: string[]
}

export interface RouteFilters {
  name?: string | null
  uri?: string | null
  method?: string | null
}

export function filterRoutes(routes: RouteEntry[], filters: RouteFilters): RouteEntry[] {
  const nameFilter = filters.name ? String(filters.name).toLowerCase() : null
  const uriFilter = filters.uri ? String(filters.uri).toLowerCase() : null
  const methodFilter = filters.method ? String(filters.method).toUpperCase() : null

  return routes.filter((r) => {
    if (nameFilter && (!r.name || !r.name.toLowerCase().includes(nameFilter))) return false
    if (uriFilter && !r.uri.toLowerCase().includes(uriFilter)) return false
    if (methodFilter && !r.method.toUpperCase().includes(methodFilter)) return false
    return true
  })
}

export function formatRouteList(routes: RouteEntry[]): string {
  if (routes.length === 0) {
    return "No routes matched the filters."
  }

  const lines = routes.map((r) => {
    const method = r.method.includes("|") ? r.method : r.method.padEnd(8)
    const name = r.name ?? "(unnamed)"
    return `${method}  ${r.uri}  ${name}  ${r.action}`
  })

  const header = "METHOD     URI                                                   NAME                             ACTION"
  const separator = "─".repeat(header.length)
  return [header, separator, ...lines].join("\n")
}

export function executeRouteList(args: Record<string, unknown>) {
  const output = runArtisan("route:list --json")

  let routes: RouteEntry[]
  try {
    routes = JSON.parse(output)
  } catch {
    return { content: [{ type: "text" as const, text: "Failed to parse route list output. Raw output:\n" + output }] }
  }

  if (!Array.isArray(routes)) {
    return { content: [{ type: "text" as const, text: "Unexpected route list format: expected an array." }] }
  }

  const filtered = filterRoutes(routes, {
    name: args.name as string | undefined,
    uri: args.uri as string | undefined,
    method: args.method as string | undefined,
  })

  return { content: [{ type: "text" as const, text: formatRouteList(filtered) }] }
}
