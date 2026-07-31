import { runArtisan } from "../mcp.js"
import { success, failure } from "../tool-helper.js"
import { defaultPolicy } from "../security/policy.js"
import { validateArguments } from "../security/command-validator.js"

export const ALLOWED_ARTISAN_COMMANDS = defaultPolicy.getAllowedCommands()

export function isArtisanAllowed(command: string): boolean {
  return defaultPolicy.evaluate(command).allowed
}

export function executeArtisan(args: Record<string, unknown>) {
  try {
    const command = String(args.command ?? "")
    if (!command) {
      return failure("artisan", new Error("'command' argument is required"))
    }

    const decision = defaultPolicy.evaluate(command)
    if (!decision.allowed) {
      return failure("artisan", new Error(`command '${command.trim().split(/\s+/)[0]}' is not allowed. Allowed commands: ${ALLOWED_ARTISAN_COMMANDS.join(", ")}`))
    }

    const argCheck = validateArguments(command)
    if (!argCheck.allowed) {
      return failure("artisan", new Error(`command rejected: ${argCheck.reason}`))
    }

    return success(runArtisan(command))
  } catch (err) {
    return failure("artisan", err)
  }
}
