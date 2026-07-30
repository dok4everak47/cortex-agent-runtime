import { runArtisan, getLogger } from "../mcp.js"

export function executeMigrateStatus() {
  try {
    const output = runArtisan("migrate:status")
    return { content: [{ type: "text" as const, text: output }] }
  } catch (err) {
    getLogger().error("migrateStatus failed", { error: String(err) })
    return { content: [{ type: "text" as const, text: "Error: " + (err instanceof Error ? err.message : String(err)) }], isError: true as const }
  }
}
