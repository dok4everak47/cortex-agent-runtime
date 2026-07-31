import { getConfig } from "../mcp.js"
import { success, failure } from "../tool-helper.js"
import { executeDebugPlan } from "./debug/executor.js"

function buildReport(context: Record<string, unknown>): string {
  const suggest = context.suggest as { suggestions?: string[] } | undefined
  const suggestions = suggest?.suggestions ?? []
  return suggestions.length > 0 ? suggestions.join("\n\n") : "No diagnostics produced"
}

export async function executeDebugWorkflow(args: Record<string, unknown>) {
  try {
    const error = String(args.error ?? "").trim()
    if (!error) {
      return failure("debugWorkflow", new Error("'error' argument is required"))
    }

    const file = args.file ? String(args.file).trim() : undefined
    const { projectPath } = getConfig()

    const resumeFrom = args.resumeFrom ? String(args.resumeFrom) : undefined
    const { steps, context, runId, runStatus } = await executeDebugPlan(error, file, projectPath, resumeFrom)
    const report = buildReport(context)

    return success(JSON.stringify({ error, report, steps, runId, runStatus }, null, 2))
  } catch (err) {
    return failure("debugWorkflow", err)
  }
}
