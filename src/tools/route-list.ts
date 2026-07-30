import { runArtisan } from "../mcp.js"

interface RouteEntry {
  domain: string | null
  method: string
  uri: string
  name: string | null
  action: string
  middleware: string[]
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

  const nameFilter = args.name ? String(args.name).toLowerCase() : null
  const uriFilter = args.uri ? String(args.uri).toLowerCase() : null
  const methodFilter = args.method ? String(args.method).toUpperCase() : null

  const filtered = routes.filter((r) => {
    if (nameFilter && (!r.name || !r.name.toLowerCase().includes(nameFilter))) return false
    if (uriFilter && !r.uri.toLowerCase().includes(uriFilter)) return false
    if (methodFilter && !r.method.toUpperCase().includes(methodFilter)) return false
    return true
  })

  if (filtered.length === 0) {
    return { content: [{ type: "text" as const, text: "No routes matched the filters." }] }
  }

  const lines = filtered.map((r) => {
    const method = r.method.includes("|") ? r.method : r.method.padEnd(8)
    const name = r.name ?? "(unnamed)"
    return `${method}  ${r.uri}  ${name}  ${r.action}`
  })

  const header = "METHOD     URI                                                   NAME                             ACTION"
  const separator = "─".repeat(header.length)
  return { content: [{ type: "text" as const, text: [header, separator, ...lines].join("\n") }] }
}
