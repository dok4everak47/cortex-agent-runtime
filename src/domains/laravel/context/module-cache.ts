import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync, type Stats } from "fs"
import { join } from "path"
import { getLogger } from "../mcp.js"
import { collectPattern } from "../../../core/glob.js"

export { collectPattern }

export type ModuleName = "project" | "models" | "routes" | "schema" | "packages"

export type CacheEntry<T> = {
  data: T
  builtAt: number
  dependencies: Record<string, number>
}

const CACHE_ROOT = ".mcp/context"
const LEGACY_CACHE_FILE = join(".mcp", "context.json")

function statSafe(path: string): Stats | null {
  try {
    return statSync(path)
  } catch {
    return null
  }
}

export class ModuleCache {
  private projectPath: string

  constructor(projectPath: string) {
    this.projectPath = projectPath
  }

  private cacheRoot(): string {
    return join(this.projectPath, CACHE_ROOT)
  }

  private moduleFilePath(module: ModuleName): string {
    return join(this.cacheRoot(), `${module}.json`)
  }

  get<T>(module: ModuleName): CacheEntry<T> | null {
    const file = this.moduleFilePath(module)
    if (!existsSync(file)) return null
    try {
      const entry = JSON.parse(readFileSync(file, "utf-8")) as CacheEntry<T>
      if (typeof entry?.builtAt !== "number" || typeof entry?.dependencies !== "object") return null
      return entry
    } catch (err) {
      getLogger().warn("failed to read module cache", {
        module,
        error: err instanceof Error ? err.message : String(err),
      })
      return null
    }
  }

  set<T>(module: ModuleName, data: T, deps: Record<string, number>): void {
    const entry: CacheEntry<T> = { data, builtAt: Date.now(), dependencies: deps }
    try {
      mkdirSync(this.cacheRoot(), { recursive: true })
      writeFileSync(this.moduleFilePath(module), JSON.stringify(entry, null, 2), "utf-8")
    } catch (err) {
      getLogger().warn("failed to write module cache", {
        module,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  isFresh(entry: CacheEntry<unknown>, deps: Record<string, number>): boolean {
    const cached = entry.dependencies ?? {}
    const cachedKeys = Object.keys(cached)
    const currentKeys = Object.keys(deps)
    if (cachedKeys.length !== currentKeys.length) return false
    for (const key of currentKeys) {
      if (cached[key] !== deps[key]) return false
    }
    return true
  }

  collectDeps(patterns: string[]): Record<string, number> {
    const deps: Record<string, number> = {}
    for (const pattern of patterns) {
      for (const file of collectPattern(this.projectPath, pattern)) {
        const stat = statSafe(file)
        if (stat) {
          deps[file] = Math.round(stat.mtimeMs)
        }
      }
    }
    return deps
  }

  invalidate(module: ModuleName): void {
    const file = this.moduleFilePath(module)
    if (existsSync(file)) {
      rmSync(file, { force: true })
    }
  }
}

/** Wipe the entire module cache directory for a project. */
export function clearModuleCacheDir(projectPath: string): void {
  const dir = join(projectPath, CACHE_ROOT)
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Remove the legacy single-file cache (`.mcp/context.json`). */
export function clearLegacyCache(projectPath: string): void {
  const file = join(projectPath, LEGACY_CACHE_FILE)
  if (existsSync(file)) {
    getLogger().info("removing legacy context cache", { file })
    rmSync(file, { force: true })
  }
}
