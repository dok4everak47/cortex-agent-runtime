import { execSync } from "child_process"
import { getLogger } from "./mcp.js"

export function success(text: string): { content: { type: "text"; text: string }[]; isError: false } {
  return { content: [{ type: "text", text }], isError: false }
}

export function failure(toolName: string, err: unknown): { content: { type: "text"; text: string }[]; isError: true } {
  const msg = err instanceof Error ? err.message : String(err)
  getLogger().error(`${toolName} failed`, { error: msg })
  return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true }
}

export function execSafe(cmd: string, cwd?: string): string {
  getLogger().debug("execSafe", { cmd, cwd })
  try {
    return execSync(cmd, { cwd, encoding: "utf-8" }).trim()
  } catch (err) {
    const e = err as { stdout?: string | Buffer; stderr?: string | Buffer; status?: number }
    const msg = [e.stdout?.toString().trim(), e.stderr?.toString().trim()].filter(Boolean).join("\n")
    getLogger().warn("execSafe failed", { cmd, exitCode: e.status })
    return msg || `Command failed with exit code ${e.status ?? 1}`
  }
}
