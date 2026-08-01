import { getLogger } from "../mcp.js"
import { getContext as buildModuleContext } from "./builder.js"
import { clearModuleCacheDir } from "./module-cache.js"
import type { ProjectContext } from "./types.js"

export class ContextManager {
  async getContext(projectPath: string, force = false): Promise<ProjectContext> {
    if (force) {
      clearModuleCacheDir(projectPath)
      getLogger().debug("forced context rebuild", { projectPath })
    }
    return buildModuleContext(projectPath)
  }

  invalidate(projectPath: string): void {
    clearModuleCacheDir(projectPath)
    getLogger().debug("context modules invalidated", { projectPath })
  }
}

export const contextManager = new ContextManager()
