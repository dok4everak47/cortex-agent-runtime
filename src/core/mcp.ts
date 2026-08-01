import { execSync } from "child_process"
import { Logger, getLogger as _getLogger, LogLevel } from "./logger.js"

export { _getLogger as getLogger, Logger, LogLevel }

const logger = _getLogger()

export function resolveProjectPath(): string {
  return process.env.CORTEX_PROJECT_PATH ?? process.env.LARAVEL_PROJECT_PATH ?? process.cwd()
}

export function getConfig() {
  return { projectPath: resolveProjectPath() }
}

export function runCommand(command: string): string {
  const { projectPath } = getConfig()
  logger.debug("executing command", { command, cwd: projectPath })
  try {
    const output = execSync(command, { cwd: projectPath, encoding: "utf-8" }).trim()
    logger.debug("command completed", { command })
    return output
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; status?: number }
    logger.warn("command failed", { command, exitCode: e.status })
    return [e.stdout?.trim(), e.stderr?.trim()].filter(Boolean).join("\n") || `Command failed with exit code ${e.status ?? 1}`
  }
}
