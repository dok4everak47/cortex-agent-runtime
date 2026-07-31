import { getLogger } from "../mcp.js"
import { buildContext } from "./builder.js"
import { CACHE_TTL_MS, readCache, writeCache, isExpired } from "./cache.js"
import type { ProjectContext } from "./types.js"

interface CacheEntry {
  ctx: ProjectContext
  ts: number
}

export class ContextManager {
  private memory = new Map<string, CacheEntry>()

  async getContext(projectPath: string, force = false): Promise<ProjectContext> {
    const logger = getLogger()

    if (!force) {
      const mem = this.memory.get(projectPath)
      if (mem && Date.now() - mem.ts < CACHE_TTL_MS) {
        logger.debug("context served from memory cache", { projectPath })
        return { ...mem.ctx, source: "cache" }
      }

      const disk = readCache(projectPath)
      if (disk && !isExpired(disk)) {
        this.memory.set(projectPath, { ctx: disk, ts: Date.now() })
        logger.debug("context served from disk cache", { projectPath })
        return { ...disk, source: "cache" }
      }
    }

    logger.debug("building fresh context", { projectPath, force })
    const fresh = await buildContext(projectPath)
    writeCache(projectPath, fresh)
    this.memory.set(projectPath, { ctx: fresh, ts: Date.now() })
    return fresh
  }

  invalidate(projectPath: string): void {
    this.memory.delete(projectPath)
  }
}

export const contextManager = new ContextManager()
