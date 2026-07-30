import { runArtisan, getLogger } from "../mcp.js"

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
      return { content: [{ type: "text" as const, text: "Error: 'command' argument is required" }], isError: true as const }
    }

    if (!isArtisanAllowed(command)) {
      return {
        content: [{ type: "text" as const, text: `Error: command '${command.trim().split(/\s+/)[0]}' is not allowed. Allowed commands: ${ALLOWED_ARTISAN_COMMANDS.join(", ")}` }],
        isError: true as const,
      }
    }

    const output = runArtisan(command)
    return { content: [{ type: "text" as const, text: output }] }
  } catch (err) {
    getLogger().error("artisan failed", { error: String(err) })
    return { content: [{ type: "text" as const, text: "Error: " + (err instanceof Error ? err.message : String(err)) }], isError: true as const }
  }
}
