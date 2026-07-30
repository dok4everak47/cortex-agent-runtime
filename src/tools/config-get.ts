import { runArtisan } from "../mcp.js"
import { success, failure } from "../tool-helper.js"

export function executeConfigGet(args: Record<string, unknown>) {
  try {
    const key = String(args.key ?? "")
    if (!key) return failure("configGet", new Error("'key' argument is required"))
    return success(runArtisan(`config:get ${key}`) || "(empty)")
  } catch (err) {
    return failure("configGet", err)
  }
}
