import { runCommand, getLogger } from "../mcp.js"

export function executeLog(args: Record<string, unknown>) {
  try {
    const count = typeof args.lines === "number" ? args.lines : 100
    const output = runCommand(`tail -n ${count} storage/logs/laravel.log`)
    return { content: [{ type: "text" as const, text: output || "(log file is empty)" }] }
  } catch (err) {
    getLogger().error("log failed", { error: String(err) })
    return { content: [{ type: "text" as const, text: "Error: " + (err instanceof Error ? err.message : String(err)) }], isError: true as const }
  }
}
