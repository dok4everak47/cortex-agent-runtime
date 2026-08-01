import { runArtisan } from "../mcp.js"
import { success, failure } from "../../../core/tool-helper.js"

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
      return failure("makeMigration", new Error("'name' argument is required"))
    }

    const flags = buildFlags(args)
    const command = `make:migration ${name}${flags.length ? " " + flags.join(" ") : ""}`
    return success(runArtisan(command) || "Migration created successfully.")
  } catch (err) {
    return failure("makeMigration", err)
  }
}
