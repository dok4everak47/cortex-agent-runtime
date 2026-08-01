export type CommandDecision = {
  allowed: boolean
  reason?: string
  matchedRule?: string
}

export interface PolicyConfig {
  allowed?: string[]
  denied?: string[]
}

const DEFAULT_ALLOWED = [
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

const DEFAULT_DENIED = [
  "db:wipe",
  "tinker",
  "shell",
  "composer",
  "vendor:publish --force",
  "migrate:fresh",
]

export class CommandPolicy {
  private allowed: Set<string>
  private denied: Set<string>

  constructor(config?: PolicyConfig) {
    this.allowed = new Set(config?.allowed ?? DEFAULT_ALLOWED)
    this.denied = new Set(config?.denied ?? DEFAULT_DENIED)
  }

  evaluate(rawCommand: string): CommandDecision {
    const trimmed = rawCommand.trim()
    if (!trimmed) {
      return { allowed: false, reason: "empty command" }
    }

    const commandName = trimmed.split(/\s+/)[0]

    for (const denied of this.denied) {
      if (commandName === denied) {
        return { allowed: false, reason: `command '${commandName}' is denied`, matchedRule: denied }
      }
      if (trimmed === denied || trimmed.startsWith(denied + " ")) {
        return { allowed: false, reason: `command pattern '${denied}' is denied`, matchedRule: denied }
      }
    }

    if (!this.allowed.has(commandName)) {
      return {
        allowed: false,
        reason: `command '${commandName}' is not in the allowed list`,
        matchedRule: commandName,
      }
    }

    return { allowed: true }
  }

  getAllowedCommands(): string[] {
    return Array.from(this.allowed)
  }

  addAllowed(cmd: string): void {
    this.allowed.add(cmd)
  }

  addDenied(cmd: string): void {
    this.denied.add(cmd)
  }
}

export const defaultPolicy = new CommandPolicy()
