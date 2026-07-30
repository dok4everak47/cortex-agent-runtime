import { getConfig } from "../mcp.js"
import { success, failure } from "../tool-helper.js"
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

    const { steps, testOutput } = await executePlan(entity, fields, table, projectPath)

    const doneCount = steps.filter(s => s.status === "done").length
    const summary = `Created ${entity} CRUD: ${doneCount} of ${steps.length} steps completed`

    return success(JSON.stringify({ steps, testOutput, summary }, null, 2))
  } catch (err) {
    return failure("crudGenerator", err)
  }
}
