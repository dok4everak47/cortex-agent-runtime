import { runArtisan } from "../mcp.js"

export function executeMigrateStatus() {
  const output = runArtisan("migrate:status")
  return { content: [{ type: "text" as const, text: output }] }
}
