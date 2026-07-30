import { execSync } from "child_process"
import { existsSync } from "fs"
import { join } from "path"

function hasNixFlake(projectPath: string): boolean {
  return existsSync(join(projectPath, "flake.nix"))
}

function resolvePhpPath(projectPath: string): string {
  const configured = process.env.PHP_PATH
  if (configured) return configured
  try {
    execSync("php -v", { stdio: "ignore", windowsHide: true })
    return "php"
  } catch {
    // php not in PATH
  }
  if (hasNixFlake(projectPath)) {
    try {
      const out = execSync(
        `nix develop "${projectPath}" --command bash -c 'echo NIX_PHP_PATH_____START; which php; echo NIX_PHP_PATH_____END'`,
        { cwd: projectPath, encoding: "utf-8", timeout: 120_000 },
      )
      const m = out.match(/NIX_PHP_PATH_____START\n(.+?)\nNIX_PHP_PATH_____END/)
      if (m) return m[1].trim()
    } catch {
      // fall through
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
  try {
    return execSync(command, { cwd: projectPath, encoding: "utf-8" }).trim()
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; status?: number }
    return [e.stdout?.trim(), e.stderr?.trim()].filter(Boolean).join("\n") || `Command failed with exit code ${e.status ?? 1}`
  }
}

export function runArtisan(subcommand: string): string {
  const { phpPath } = getConfig()
  return runCommand(`${phpPath} artisan ${subcommand}`)
}

export function runTinker(script: string): string {
  const { phpPath } = getConfig()
  const escaped = script.replace(/'/g, "'\\''")
  return runCommand(`${phpPath} artisan tinker --execute='${escaped}'`)
}
