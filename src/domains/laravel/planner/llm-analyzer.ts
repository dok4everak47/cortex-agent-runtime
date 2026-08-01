import { getLogger } from "../mcp.js"
import type { ProjectContext } from "../context/types.js"
import type { Intent, PlannedAction } from "./plan-schema.js"

export type LLMAnalyzerConfig = {
  apiKey: string
  baseUrl: string
  model: string
  enabled: boolean
}

export const LLM_TIMEOUT_MS = 15_000

const ALLOWED_ACTIONS: PlannedAction[] = [
  "create_feature",
  "create_crud",
  "create_api",
  "add_relation",
  "add_policy",
  "add_test",
  "enhance",
  "fix_bug",
  "debug",
]

export function getLLMConfig(): LLMAnalyzerConfig {
  return {
    apiKey: process.env.LLM_API_KEY ?? "",
    baseUrl: process.env.LLM_BASE_URL ?? "https://api.deepseek.com/v1",
    model: process.env.LLM_MODEL ?? "deepseek-chat",
    enabled: !!process.env.LLM_API_KEY,
  }
}

export function buildContextSummary(ctx: ProjectContext): string {
  const lines: string[] = []
  lines.push(`应用: ${ctx.app?.name ?? ""}`)
  lines.push(`框架: Laravel ${ctx.laravel?.version ?? ""} / PHP ${ctx.laravel?.phpVersion ?? ""}`)
  lines.push(`数据库: ${ctx.laravel?.database?.driver ?? ""} (${ctx.laravel?.database?.name ?? ""})`)
  lines.push(`模型: ${ctx.models?.join(", ") || "无"}`)
  lines.push(`数据表: ${ctx.tables?.join(", ") || "无"}`)
  lines.push(`路由: ${ctx.routes?.count ?? 0} 条`)
  lines.push(`生产依赖: ${ctx.packages?.production?.join(", ") || "无"}`)
  lines.push(`前端技术栈: ${ctx.frontend?.join(", ") || "无"}`)
  return lines.join("\n")
}

function summarizeContext(projectContext: unknown): string {
  if (projectContext && typeof projectContext === "object") {
    const ctx = projectContext as Partial<ProjectContext>
    if (Array.isArray(ctx.models)) return buildContextSummary(projectContext as ProjectContext)
    const s = JSON.stringify(projectContext)
    return s ? s.slice(0, 2000) : ""
  }
  if (typeof projectContext === "string") return projectContext.slice(0, 2000)
  return ""
}

export function buildPrompt(
  request: string,
  contextSummary: string,
): { system: string; user: string } {
  const system = [
    "你是 Laravel 项目的 AI 架构师。根据用户需求和项目上下文，输出 JSON 格式的开发意图。只输出 JSON，不要输出任何解释。",
    "",
    "可用动作:",
    "- create_feature: 创建完整功能（含视图）",
    "- create_crud: 创建基础 CRUD",
    "- create_api: 创建 REST API",
    "- add_relation: 添加模型关系",
    "- add_policy: 添加权限策略",
    "- add_test: 添加测试",
    "- enhance: 增强/优化现有功能",
    "- fix_bug: 修复 bug",
    "- debug: 调试",
    "",
    "JSON 格式:",
    "{",
    '  "action": "enhance",',
    '  "entity": "SearchController",',
    '  "target": "search",',
    '  "fields": null,',
    '  "options": { "views": false, "api": false, "auth": false },',
    '  "summary": "用 PostgreSQL 全文搜索替代 LIKE，支持相关度排序"',
    "}",
    "",
    "约束:",
    "- action 必须是上述列表之一",
    "- entity 是目标实体/控制器名（如 Post、SearchController），不确定时填空字符串",
    "- summary 用中文简要说明改动方案",
  ].join("\n")

  const user = [
    `项目上下文:\n${contextSummary || "(无)"}`,
    "",
    `需求: ${request}`,
  ].join("\n")

  return { system, user }
}

function extractJSON(content: string): string | null {
  const trimmed = content.trim()
  if (!trimmed) return null

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()

  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1)

  return trimmed
}

function normalizeLlmIntent(data: unknown, request: string): Intent | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>

  const action = String(d.action ?? "").trim() as PlannedAction
  if (!ALLOWED_ACTIONS.includes(action)) return null

  const entity = typeof d.entity === "string" ? d.entity.trim() : ""
  const target = typeof d.target === "string" && d.target.trim() ? d.target.trim() : undefined
  const summary = typeof d.summary === "string" && d.summary.trim() ? d.summary.trim() : undefined
  const fields = typeof d.fields === "string" && d.fields.trim() ? d.fields.trim() : undefined

  const opts = d.options && typeof d.options === "object" ? (d.options as Record<string, unknown>) : {}
  const options: Intent["options"] = {}
  if (typeof opts.views === "boolean") options.views = opts.views
  if (typeof opts.api === "boolean") options.api = opts.api
  if (typeof opts.auth === "boolean") options.auth = opts.auth
  if (action === "create_api") {
    options.api = true
    if (options.views === undefined) options.views = false
  }

  return {
    action,
    entity,
    target,
    fields,
    options,
    confidence: 0.95,
    raw: request,
    summary,
  }
}

function chatEndpoint(baseUrl: string): string {
  const url = baseUrl.replace(/\/+$/, "")
  return /\/chat\/completions$/i.test(url) ? url : `${url}/chat/completions`
}

export async function analyzeIntent(
  request: string,
  projectContext: unknown,
): Promise<Intent | null> {
  const cfg = getLLMConfig()
  if (!cfg.enabled) return null

  const logger = getLogger()
  const { system, user } = buildPrompt(request, summarizeContext(projectContext))

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  try {
    const response = await fetch(chatEndpoint(cfg.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0,
        stream: false,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      logger.warn("LLM intent analysis returned non-ok status", { status: response.status })
      return null
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = body.choices?.[0]?.message?.content ?? ""
    if (!content) return null

    const json = extractJSON(content)
    if (!json) return null

    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch (err) {
      logger.warn("LLM intent analysis returned invalid JSON", {
        error: err instanceof Error ? err.message : String(err),
      })
      return null
    }

    return normalizeLlmIntent(parsed, request)
  } catch (err) {
    logger.warn("LLM intent analysis failed", {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  } finally {
    clearTimeout(timer)
  }
}
