import { execSync } from "child_process"
import { existsSync } from "fs"
import { join } from "path"
import { getLogger, Logger, LogLevel, runCommand, resolveProjectPath } from "../../core/mcp.js"

export { getLogger, Logger, LogLevel, runCommand }

const logger = getLogger()

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
  const projectPath = resolveProjectPath()
  if (!cachedPhpPath) {
    cachedPhpPath = resolvePhpPath(projectPath)
  }
  return { projectPath, phpPath: cachedPhpPath }
}

export function runArtisan(subcommand: string): string {
  const { phpPath } = getConfig()
  logger.debug("running artisan", { subcommand })
  return runCommand(`${phpPath} artisan ${subcommand}`)
}

export function runTinker(script: string): string {
  const { phpPath } = getConfig()
  const escaped = script.replace(/'/g, "'\\''")
  logger.debug("running tinker", { scriptLength: script.length })
  return runCommand(`${phpPath} artisan tinker --execute='${escaped}'`)
}
