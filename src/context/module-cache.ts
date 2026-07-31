import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, type Stats } from "fs"
import { join } from "path"
import { getLogger } from "../mcp.js"

export type ModuleName = "project" | "models" | "routes" | "schema" | "packages"

export type CacheEntry<T> = {
  data: T
  builtAt: number
  dependencies: Record<string, number>
}

const CACHE_ROOT = ".mcp/context"
const LEGACY_CACHE_FILE = join(".mcp", "context.json")

function hasGlobMeta(pattern: string): boolean {
  return pattern.includes("*")
}

function matchGlobSegment(name: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")
  return new RegExp(`^${escaped}$`).test(name)
}

function readdirSafe(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

function statSafe(path: string): Stats | null {
  try {
    return statSync(path)
  } catch {
    return null
  }
}

/** Resolve a relative glob pattern (supporting `*` and `**`) to absolute file paths. */
export function collectPattern(root: string, pattern: string): string[] {
  if (!hasGlobMeta(pattern)) {
    const full = join(root, pattern)
    return existsSync(full) ? [full] : []
  }

  const segments = pattern.split("/")
  const results: string[] = []

  const walk = (remaining: string[], current: string): void => {
    if (remaining.length === 0) return
    const [seg, ...rest] = remaining

    if (seg === "**") {
      walk(rest, current)
      for (const entry of readdirSafe(current)) {
        const full = join(current, entry)
        if (statSafe(full)?.isDirectory()) {
          walk(remaining, full)
        }
      }
      return
    }

    if (seg.includes("*")) {
      for (const entry of readdirSafe(current)) {
        if (!matchGlobSegment(entry, seg)) continue
        const full = join(current, entry)
        const stat = statSafe(full)
        if (rest.length === 0) {
          if (stat?.isFile()) results.push(full)
        } else if (stat?.isDirectory()) {
          walk(rest, full)
        }
      }
      return
    }

    const full = join(current, seg)
    const stat = statSafe(full)
    if (rest.length === 0) {
      if (stat?.isFile()) results.push(full)
    } else if (stat?.isDirectory()) {
      walk(rest, full)
    }
  }

  walk(segments, root)
  return results
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
