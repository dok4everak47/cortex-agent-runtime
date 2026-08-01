import { success, failure } from "../tool-helper.js"

export async function executeToolStats(args: Record<string, unknown>) {
  try {
    const { registry } = await import("../registry.js")
    if (args.reset === true) {
      registry.resetToolStats()
    }
    return success(JSON.stringify(registry.getToolStats(), null, 2))
  } catch (err) {
    return failure("toolStats", err)
  }
}
