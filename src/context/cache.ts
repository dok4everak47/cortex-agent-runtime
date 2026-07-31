import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { getLogger } from "../mcp.js"
import type { ProjectContext } from "./types.js"

export const CACHE_TTL_MS = 5 * 60 * 1000

const CACHE_DIR = ".mcp"
const CACHE_FILE = join(CACHE_DIR, "context.json")

export function cacheFilePath(projectPath: string): string {
  return join(projectPath, CACHE_FILE)
}

export function readCache(projectPath: string): ProjectContext | null {
  try {
    const file = cacheFilePath(projectPath)
    if (!existsSync(file)) return null
    const data = JSON.parse(readFileSync(file, "utf-8")) as ProjectContext
    if (typeof data?.builtAt !== "number") return null
    return data
  } catch (err) {
    getLogger().warn("failed to read context cache", {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

export function writeCache(projectPath: string, ctx: ProjectContext): void {
  try {
    mkdirSync(join(projectPath, CACHE_DIR), { recursive: true })
    writeFileSync(cacheFilePath(projectPath), JSON.stringify(ctx, null, 2), "utf-8")
  } catch (err) {
    getLogger().warn("failed to write context cache", {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

export function isExpired(cached: ProjectContext): boolean {
  return Date.now() - cached.builtAt > CACHE_TTL_MS
}
