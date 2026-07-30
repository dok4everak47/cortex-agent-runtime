import { runArtisan } from "../mcp.js"

const cacheActions: Record<string, string> = {
  clear: "cache:clear",
  configCache: "config:cache",
  configClear: "config:clear",
  routeCache: "route:cache",
  routeClear: "route:clear",
  viewClear: "view:clear",
}

export function executeCache(args: Record<string, unknown>) {
  const action = String(args.action ?? "")
  const command = cacheActions[action]
  if (!command) {
    return { content: [{ type: "text" as const, text: `Error: unknown action '${action}'. Valid actions: ${Object.keys(cacheActions).join(", ")}` }] }
  }
  const output = runArtisan(command)
  return { content: [{ type: "text" as const, text: output || `${command} executed successfully` }] }
}
