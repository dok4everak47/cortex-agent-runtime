import { execSync } from "child_process"
import { existsSync } from "fs"
import { join } from "path"
import { Logger, getLogger as _getLogger, LogLevel } from "./logger.js"

// Re-export for other modules
export { _getLogger as getLogger, Logger, LogLevel }

const logger = _getLogger()

function hasNixFlake(projectPath: string): boolean {
  return existsSync(join(projectPath, "flake.nix"))
}

function resolvePhpPath(projectPath: string): string {
  const configured = process.env.PHP_PATH
  if (configured) {
    logger.debug("php path from env", { PHP_PATH: configured })
    return configured
  }
  try {
    execSync("php -v", { stdio: "ignore", windowsHide: true })
    logger.debug("php found in PATH")
    return "php"
  } catch {
    logger.debug("php not in PATH")
  }
  if (hasNixFlake(projectPath)) {
    try {
      const out = execSync(
        `nix develop "${projectPath}" --command bash -c 'echo NIX_PHP_PATH_____START; which php; echo NIX_PHP_PATH_____END'`,
        { cwd: projectPath, encoding: "utf-8", timeout: 120_000 },
      )
      const m = out.match(/NIX_PHP_PATH_____START\n(.+?)\nNIX_PHP_PATH_____END/)
      if (m) {
        logger.debug("php path from nix flake", { phpPath: m[1].trim() })
        return m[1].trim()
      }
    } catch {
      logger.debug("nix flake php lookup failed, falling back to default")
    }
  }
  return "php"
}

let cachedPhpPath: string | undefined

export function getConfig() {
  const projectPath = process.env.LARAVEL_PROJECT_PATH ?? process.cwd()
  if (!cachedPhpPath) {
    cachedPhpPath = resolvePhpPath(projectPath)
  }
  return { projectPath, phpPath: cachedPhpPath }
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

export function runArtisan(subcommand: string): string {
  const { phpPath } = getConfig()
  logger.debug("running artisan", { subcommand })
  const result = runCommand(`${phpPath} artisan ${subcommand}`)
  return result
}

export function runTinker(script: string): string {
  const { phpPath } = getConfig()
  const escaped = script.replace(/'/g, "'\\''")
  logger.debug("running tinker", { scriptLength: script.length })
  return runCommand(`${phpPath} artisan tinker --execute='${escaped}'`)
}
