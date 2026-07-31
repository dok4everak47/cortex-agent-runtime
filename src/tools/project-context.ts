import { getConfig } from "../mcp.js"
import { contextManager } from "../context/context-manager.js"
import { success, failure } from "../tool-helper.js"

export async function executeProjectContext(args: Record<string, unknown>) {
  try {
    const { projectPath } = getConfig()
    const force = Boolean(args.force)
    const ctx = await contextManager.getContext(projectPath, force)
    return success(JSON.stringify(ctx, null, 2))
  } catch (err) {
    return failure("projectContext", err)
  }
}
