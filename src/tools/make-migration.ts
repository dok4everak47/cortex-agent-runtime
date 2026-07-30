import { runArtisan, getLogger } from "../mcp.js"

function buildFlags(args: Record<string, unknown>): string[] {
  const flags: string[] = []
  if (args.table) {
    flags.push(`--table=${args.table}`)
  }
  if (args.create) {
    flags.push("--create")
  }
  return flags
}

export function executeMakeMigration(args: Record<string, unknown>) {
  try {
    const name = String(args.name ?? "").trim()
    if (!name) {
      return { content: [{ type: "text" as const, text: "Error: 'name' argument is required" }], isError: true as const }
    }

    const flags = buildFlags(args)
    const command = `make:migration ${name}${flags.length ? " " + flags.join(" ") : ""}`
    const output = runArtisan(command)
    return { content: [{ type: "text" as const, text: output || "Migration created successfully." }] }
  } catch (err) {
    getLogger().error("makeMigration failed", { error: String(err) })
    return { content: [{ type: "text" as const, text: "Error: " + (err instanceof Error ? err.message : String(err)) }], isError: true as const }
  }
}
