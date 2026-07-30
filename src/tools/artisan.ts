import { runArtisan } from "../mcp.js"
import { success, failure } from "../tool-helper.js"

export const ALLOWED_ARTISAN_COMMANDS = [
  "make:model",
  "make:controller",
  "make:migration",
  "make:factory",
  "make:seeder",
  "make:request",
  "make:test",
  "make:policy",
  "migrate",
  "migrate:status",
  "migrate:rollback",
  "route:list",
  "cache:clear",
  "config:clear",
  "config:get",
  "view:clear",
  "optimize:clear",
  "test",
  "env",
]

export function isArtisanAllowed(command: string): boolean {
  const base = command.trim().split(/\s+/)[0]
  return ALLOWED_ARTISAN_COMMANDS.includes(base)
}

export function executeArtisan(args: Record<string, unknown>) {
  try {
    const command = String(args.command ?? "")
    if (!command) {
      return failure("artisan", new Error("'command' argument is required"))
    }

    if (!isArtisanAllowed(command)) {
      return failure("artisan", new Error(`command '${command.trim().split(/\s+/)[0]}' is not allowed. Allowed commands: ${ALLOWED_ARTISAN_COMMANDS.join(", ")}`))
    }

    return success(runArtisan(command))
  } catch (err) {
    return failure("artisan", err)
  }
}
