import { runArtisan } from "../mcp.js"
import { success, failure } from "../../../core/tool-helper.js"

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
      return failure("cache", new Error(`unknown action '${action}'. Valid actions: ${Object.keys(cacheActions).join(", ")}`))
    }
    return success(runArtisan(command) || `${command} executed successfully`)
  } catch (err) {
    return failure("cache", err)
  }
}
