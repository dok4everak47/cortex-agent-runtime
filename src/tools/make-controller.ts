import { runArtisan } from "../mcp.js"

function buildFlags(args: Record<string, unknown>): string[] {
  const flags: string[] = []
  if (args.resource) {
    if (args.model) {
      flags.push(`--model=${args.model}`)
    }
    if (args.api) {
      flags.push("--api")
    } else {
      flags.push("--resource")
    }
  }
  return flags
}

export function executeMakeController(args: Record<string, unknown>) {
  const name = String(args.name ?? "").trim()
  if (!name) {
    return { content: [{ type: "text" as const, text: "Error: 'name' argument is required" }] }
  }

  const flags = buildFlags(args)
  const command = `make:controller ${name}${flags.length ? " " + flags.join(" ") : ""}`
  const output = runArtisan(command)
  return { content: [{ type: "text" as const, text: output || "Controller created successfully." }] }
}
