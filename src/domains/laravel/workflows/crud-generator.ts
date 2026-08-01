import { getConfig } from "../mcp.js"
import { success, failure } from "../../../core/tool-helper.js"
import { executePlan } from "./crud/executor.js"

export async function executeCrudGenerator(args: Record<string, unknown>) {
  try {
    const entity = String(args.entity ?? "").trim()
    if (!entity) {
      return failure("crudGenerator", new Error("'entity' argument is required"))
    }

    const fields = String(args.fields ?? "")
    const table = args.table ? String(args.table).trim() : undefined
    const { projectPath } = getConfig()

    const resumeFrom = args.resumeFrom ? String(args.resumeFrom) : undefined
    const { steps, testOutput, runId, runStatus } = await executePlan(entity, fields, table, projectPath, resumeFrom)

    const doneCount = steps.filter(s => s.status === "done").length
    const summary = `Created ${entity} CRUD: ${doneCount} of ${steps.length} steps completed`

    return success(JSON.stringify({ steps, testOutput, summary, runId, runStatus }, null, 2))
  } catch (err) {
    return failure("crudGenerator", err)
  }
}
