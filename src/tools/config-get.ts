import { runArtisan } from "../mcp.js"

export function executeConfigGet(args: Record<string, unknown>) {
  const key = String(args.key ?? "")
  if (!key) return { content: [{ type: "text" as const, text: "Error: 'key' argument is required" }] }
  const output = runArtisan(`config:get ${key}`)
  return { content: [{ type: "text" as const, text: output || "(empty)" }] }
}
