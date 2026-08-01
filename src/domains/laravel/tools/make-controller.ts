import { runArtisan } from "../mcp.js"
import { success, failure } from "../../../core/tool-helper.js"

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
  try {
    const name = String(args.name ?? "").trim()
    if (!name) {
      return failure("makeController", new Error("'name' argument is required"))
    }

    const flags = buildFlags(args)
    const command = `make:controller ${name}${flags.length ? " " + flags.join(" ") : ""}`
    return success(runArtisan(command) || "Controller created successfully.")
  } catch (err) {
    return failure("makeController", err)
  }
}
