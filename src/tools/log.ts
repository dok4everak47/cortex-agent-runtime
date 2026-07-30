import { runCommand } from "../mcp.js"
import { success, failure } from "../tool-helper.js"

export function executeLog(args: Record<string, unknown>) {
  try {
    const count = typeof args.lines === "number" ? args.lines : 100
    return success(runCommand(`tail -n ${count} storage/logs/laravel.log`) || "(log file is empty)")
  } catch (err) {
    return failure("log", err)
  }
}
