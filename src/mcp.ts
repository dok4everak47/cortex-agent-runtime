import { execSync } from "child_process"

export function getConfig() {
  return {
    projectPath: process.env.LARAVEL_PROJECT_PATH ?? process.cwd(),
    phpPath: process.env.PHP_PATH ?? "php",
  }
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
