import { getConfig } from "../mcp.js"
import { success, failure } from "../tool-helper.js"
import { executeApiPlan } from "./api/executor.js"

export async function executeApiGenerator(args: Record<string, unknown>) {
  try {
    const entity = String(args.entity ?? "").trim()
    if (!entity) {
      return failure("apiGenerator", new Error("'entity' argument is required"))
    }

    const fields = String(args.fields ?? "")
    const auth = args.auth === true
    const { projectPath } = getConfig()

    const { steps, testOutput } = await executeApiPlan(entity, fields, auth, projectPath)

    const doneCount = steps.filter(s => s.status === "done").length
    const summary = `Created ${entity} API: ${doneCount} of ${steps.length} steps completed`

    return success(JSON.stringify({ steps, testOutput, summary }, null, 2))
  } catch (err) {
    return failure("apiGenerator", err)
  }
}
