import { runArtisan, getLogger } from "../mcp.js"

const cacheActions: Record<string, string> = {
  clear: "cache:clear",
  configCache: "config:cache",
  configClear: "config:clear",
  routeCache: "route:cache",
  routeClear: "route:clear",
  viewClear: "view:clear",
}

export function executeCache(args: Record<string, unknown>) {
  try {
    const action = String(args.action ?? "")
    const command = cacheActions[action]
    if (!command) {
      return { content: [{ type: "text" as const, text: `Error: unknown action '${action}'. Valid actions: ${Object.keys(cacheActions).join(", ")}` }], isError: true as const }
    }
    const output = runArtisan(command)
    return { content: [{ type: "text" as const, text: output || `${command} executed successfully` }] }
  } catch (err) {
    getLogger().error("cache failed", { error: String(err) })
    return { content: [{ type: "text" as const, text: "Error: " + (err instanceof Error ? err.message : String(err)) }], isError: true as const }
  }
}
