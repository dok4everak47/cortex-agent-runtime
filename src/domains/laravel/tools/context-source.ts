import { getConfig } from "../mcp.js"
import { contextManager } from "../context/context-manager.js"
import { success, failure } from "../../../core/tool-helper.js"

export async function executeContextSource(args: Record<string, unknown>) {
  try {
    const { projectPath } = getConfig()
    const force = Boolean(args.force)
    const ctx = await contextManager.getContext(projectPath, force)
    const report = {
      modules: ctx.sourceByModule,
      builtAt: ctx.builtAt,
      overall: ctx.source,
    }
    return success(JSON.stringify(report, null, 2))
  } catch (err) {
    return failure("contextSource", err)
  }
}
