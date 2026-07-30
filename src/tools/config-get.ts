import { runArtisan, getLogger } from "../mcp.js"

export function executeConfigGet(args: Record<string, unknown>) {
  try {
    const key = String(args.key ?? "")
    if (!key) return { content: [{ type: "text" as const, text: "Error: 'key' argument is required" }], isError: true as const }
    const output = runArtisan(`config:get ${key}`)
    return { content: [{ type: "text" as const, text: output || "(empty)" }] }
  } catch (err) {
    getLogger().error("configGet failed", { error: String(err) })
    return { content: [{ type: "text" as const, text: "Error: " + (err instanceof Error ? err.message : String(err)) }], isError: true as const }
  }
}
