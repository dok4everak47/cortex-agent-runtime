import { runArtisan } from "../mcp.js"

function buildFlags(args: Record<string, unknown>): string {
  const flags: string[] = []
  if (args.migration) flags.push("-m")
  if (args.factory) flags.push("-f")
  if (args.seed) flags.push("-s")
  return flags.join("")
}

export function executeMakeModel(args: Record<string, unknown>) {
  const name = String(args.name ?? "").trim()
  if (!name) {
    return { content: [{ type: "text" as const, text: "Error: 'name' argument is required" }] }
  }

  const flags = buildFlags(args)
  const command = `make:model ${name}${flags ? " " + flags : ""}`
  const output = runArtisan(command)
  return { content: [{ type: "text" as const, text: output || "Model created successfully." }] }
}
