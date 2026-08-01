import { runArtisan } from "../mcp.js"
import { success, failure } from "../../../core/tool-helper.js"

function buildFlags(args: Record<string, unknown>): string {
  const flags: string[] = []
  if (args.migration) flags.push("-m")
  if (args.factory) flags.push("-f")
  if (args.seed) flags.push("-s")
  return flags.join("")
}

export function executeMakeModel(args: Record<string, unknown>) {
  try {
    const name = String(args.name ?? "").trim()
    if (!name) {
      return failure("makeModel", new Error("'name' argument is required"))
    }

    const flags = buildFlags(args)
    const command = `make:model ${name}${flags ? " " + flags : ""}`
    return success(runArtisan(command) || "Model created successfully.")
  } catch (err) {
    return failure("makeModel", err)
  }
}
