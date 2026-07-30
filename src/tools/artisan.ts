import { runArtisan } from "../mcp.js"

export function executeArtisan(args: Record<string, unknown>) {
  const command = String(args.command ?? "")
  if (!command) return { content: [{ type: "text" as const, text: "Error: 'command' argument is required" }] }
  const output = runArtisan(command)
  return { content: [{ type: "text" as const, text: output }] }
}
