import { runCommand } from "../mcp.js"

export function executeLog(args: Record<string, unknown>) {
  const count = typeof args.lines === "number" ? args.lines : 100
  const output = runCommand(`tail -n ${count} storage/logs/laravel.log`)
  return { content: [{ type: "text" as const, text: output || "(log file is empty)" }] }
}
