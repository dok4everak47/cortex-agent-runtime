import { getConfig, getLogger } from "../mcp.js"
import { success, failure } from "../tool-helper.js"
import { parseIntent as parseIntentRuleBased } from "./intent-parser.js"
import { analyzeIntent as analyzeIntentImpl, getLLMConfig as getLLMConfigImpl } from "./llm-analyzer.js"
import type { LLMAnalyzerConfig } from "./llm-analyzer.js"
import { makeFeaturePlan } from "./feature-planner.js"
import type { Intent } from "./plan-schema.js"
import { contextManager } from "../context/context-manager.js"
import { toPascalCase } from "../workflows/crud/planner.js"
import { executeFeaturePlan } from "../workflows/feature/executor.js"
import { executePlan } from "../workflows/crud/executor.js"
import { executeApiPlan } from "../workflows/api/executor.js"
import { executeDebugPlan } from "../workflows/debug/executor.js"

export { parseIntentRuleBased } from "./intent-parser.js"
export { makeFeaturePlan } from "./feature-planner.js"
export { getLLMConfig, analyzeIntent } from "./llm-analyzer.js"
export type {
  Intent,
  Plan,
  PlanStep,
  PlannedAction,
  Relation,
  RelationType,
} from "./plan-schema.js"
export type { LLMAnalyzerConfig } from "./llm-analyzer.js"

export type IntentPlannerDeps = {
  getLLMConfig?: () => LLMAnalyzerConfig
  analyzeIntent?: (request: string, context: unknown) => Promise<Intent | null>
  loadContext?: (projectPath: string) => Promise<unknown>
}

export async function parseIntent(
  input: string,
  projectPath?: string,
  deps: IntentPlannerDeps = {},
): Promise<Intent> {
  const {
    getLLMConfig: getLLM = getLLMConfigImpl,
    analyzeIntent: analyze = analyzeIntentImpl,
    loadContext = (p) => contextManager.getContext(p),
  } = deps

  const ruleBased = parseIntentRuleBased(input)

  if (ruleBased.confidence >= 0.8) {
    return ruleBased
  }

  // 置信度低 → 尝试 LLM 语义层
  const llmConfig = getLLM()
  if (llmConfig.enabled && projectPath) {
    try {
      const context = await loadContext(projectPath)
      const llmResult = await analyze(input, context)
      if (llmResult) return llmResult
    } catch (err) {
      getLogger().warn("LLM intent analysis failed, falling back to rule-based", {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // LLM 不可用或失败 → 回退规则版
  return {
    ...ruleBased,
    summary: ruleBased.confidence < 0.8 ? "低置信度，建议启用 LLM_API_KEY" : ruleBased.summary,
  }
}

function controllerPath(entity: string): string | undefined {
  return entity ? `app/Http/Controllers/${toPascalCase(entity)}.php` : undefined
}

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
    case "enhance":
      return executeDebugPlan(intent.raw, controllerPath(intent.entity), projectPath)
    case "fix_bug":
      return executeDebugPlan(intent.raw, undefined, projectPath)
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

    const intent = await parseIntent(request, projectPath)
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
