import { getConfig } from "../mcp.js"
import { success, failure } from "../tool-helper.js"
import { parseIntent } from "./intent-parser.js"
import { makeFeaturePlan } from "./feature-planner.js"
import type { Intent } from "./plan-schema.js"
import { executeFeaturePlan } from "../workflows/feature/executor.js"
import { executePlan } from "../workflows/crud/executor.js"
import { executeApiPlan } from "../workflows/api/executor.js"
import { executeDebugPlan } from "../workflows/debug/executor.js"

export { parseIntent } from "./intent-parser.js"
export { makeFeaturePlan } from "./feature-planner.js"
export type {
  Intent,
  Plan,
  PlanStep,
  PlannedAction,
  Relation,
  RelationType,
} from "./plan-schema.js"

async function executeIntent(intent: Intent, projectPath: string) {
  switch (intent.action) {
    case "create_feature":
      return executeFeaturePlan(
        intent.entity,
        intent.fields,
        {
          views: intent.options.views !== false,
          api: intent.options.api === true,
        },
        projectPath,
      )
    case "create_crud":
      return executePlan(intent.entity, intent.fields, undefined, projectPath)
    case "create_api":
      return executeApiPlan(intent.entity, intent.fields, intent.options.auth === true, projectPath)
    case "debug":
      return executeDebugPlan(intent.raw, undefined, projectPath)
    default:
      return { note: `'${intent.action}' 尚无可用的执行工作流，仅生成计划（dryRun=true）。` }
  }
}

export async function handleIntentPlanner(args: Record<string, unknown>) {
  try {
    const request = String(args.request ?? "").trim()
    if (!request) {
      return failure("intentPlanner", new Error("'request' argument is required"))
    }

    const dryRun = args.dryRun !== false
    const { projectPath } = getConfig()

    const intent = parseIntent(request)
    const plan = await makeFeaturePlan(intent, projectPath)

    if (dryRun) {
      return success(JSON.stringify({ mode: "plan", intent, plan }, null, 2))
    }

    const isCreateAction =
      intent.action === "create_feature" ||
      intent.action === "create_crud" ||
      intent.action === "create_api"
    if (isCreateAction && !intent.entity) {
      return success(
        JSON.stringify(
          {
            mode: "plan",
            intent,
            plan,
            note: "无法识别目标实体，未执行。请补充实体名称（如 '给 Post 生成 CRUD'）。",
          },
          null,
          2,
        ),
      )
    }

    const executed = await executeIntent(intent, projectPath)
    return success(JSON.stringify({ mode: "executed", intent, plan, executed }, null, 2))
  } catch (err) {
    return failure("intentPlanner", err)
  }
}
