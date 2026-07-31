import { contextManager } from "../context/context-manager.js"
import type { ProjectContext } from "../context/types.js"
import { parseFields, pluralize, snakeCase, toPascalCase } from "../workflows/crud/planner.js"
import type { Intent, Plan, PlanStep, PlannedAction, RelationType } from "./plan-schema.js"

export type ContextLoader = (projectPath: string) => Promise<ProjectContext>

interface Derived {
  entityPascal: string
  entitySnake: string
  entityPlural: string
  table: string
  fields: { name: string; type: string }[]
}

function derive(entity: string, fields?: string): Derived {
  const entityPascal = toPascalCase(entity)
  const entitySnake = snakeCase(entity)
  const entityPlural = snakeCase(pluralize(entity))
  return {
    entityPascal,
    entitySnake,
    entityPlural,
    table: entityPlural,
    fields: parseFields(fields),
  }
}

function step(
  n: number,
  type: string,
  action: PlannedAction,
  params: Record<string, unknown>,
  opts: { optional?: boolean; dependsOn?: number[] } = {},
): PlanStep {
  return { step: n, type, action, params, optional: opts.optional, dependsOn: opts.dependsOn }
}

function relationSteps(intent: Intent): PlanStep[] {
  const rel = intent.options.relation
  const entity = rel?.on ?? intent.entity
  const target = rel?.target ?? ""
  const b = derive(entity)

  return [
    step(1, "migration", intent.action, {
      entitySnake: b.entitySnake,
      entityPlural: b.entityPlural,
      table: b.table,
      fields: target ? [{ name: `${snakeCase(target)}_id`, type: "foreignId" }] : [],
      relation: rel,
    }),
    step(2, "model", intent.action, { entityPascal: b.entityPascal, relation: rel }, { dependsOn: [1] }),
  ]
}

function policySteps(intent: Intent): PlanStep[] {
  const b = derive(intent.entity)
  return [
    step(1, "policy", intent.action, { entityPascal: b.entityPascal }),
    step(2, "registerPolicy", intent.action, { entityPascal: b.entityPascal }, { dependsOn: [1] }),
    step(3, "model", intent.action, { entityPascal: b.entityPascal }, { dependsOn: [2] }),
  ]
}

function debugSteps(intent: Intent): PlanStep[] {
  const firstLine = intent.raw.split("\n").map((l) => l.trim()).find(Boolean) ?? ""
  return [
    step(1, "locate", intent.action, { hint: undefined }, { optional: true }),
    step(2, "analyze", intent.action, { file: undefined }, { optional: true, dependsOn: [1] }),
    step(3, "diagnose", intent.action, { error: intent.raw, message: firstLine }, { dependsOn: [2] }),
    step(4, "suggest", intent.action, {}, { dependsOn: [3] }),
  ]
}

function buildSteps(intent: Intent, ctx: ProjectContext): PlanStep[] {
  const action = intent.action
  const entity = intent.entity
  const b = derive(entity, intent.fields)
  const entityExists = entity ? ctx.models.includes(b.entityPascal) : false
  const auth = intent.options.auth === true

  switch (action) {
    case "create_feature": {
      return [
        step(1, "migration", action, { entitySnake: b.entitySnake, entityPlural: b.entityPlural, table: b.table, fields: b.fields }, { optional: entityExists }),
        step(2, "model", action, { entityPascal: b.entityPascal, fields: b.fields }, { optional: entityExists, dependsOn: [1] }),
        step(3, "controller", action, { entityPascal: b.entityPascal }, { dependsOn: [2] }),
        step(4, "request", action, { entityPascal: b.entityPascal, fields: b.fields }, { dependsOn: [3] }),
        step(5, "route", action, { entityPascal: b.entityPascal, entityPlural: b.entityPlural }, { dependsOn: [4] }),
        step(6, "views", action, { entityPascal: b.entityPascal, entitySnake: b.entitySnake, entityPlural: b.entityPlural, fields: b.fields }, { dependsOn: [5] }),
        step(7, "test", action, { entityPascal: b.entityPascal, entitySnake: b.entitySnake, entityPlural: b.entityPlural, table: b.table, fields: b.fields }, { dependsOn: [6] }),
      ]
    }
    case "create_crud": {
      return [
        step(1, "migration", action, { entitySnake: b.entitySnake, entityPlural: b.entityPlural, table: b.table, fields: b.fields }, { optional: entityExists }),
        step(2, "model", action, { entityPascal: b.entityPascal, fields: b.fields }, { optional: entityExists, dependsOn: [1] }),
        step(3, "controller", action, { entityPascal: b.entityPascal }, { dependsOn: [2] }),
        step(4, "request", action, { entityPascal: b.entityPascal, fields: b.fields }, { dependsOn: [3] }),
        step(5, "route", action, { entityPascal: b.entityPascal, entityPlural: b.entityPlural }, { dependsOn: [4] }),
        step(6, "test", action, { entityPascal: b.entityPascal, entitySnake: b.entitySnake, entityPlural: b.entityPlural, table: b.table, fields: b.fields }, { dependsOn: [5] }),
      ]
    }
    case "create_api": {
      return [
        step(1, "migration", action, { entitySnake: b.entitySnake, entityPlural: b.entityPlural, table: b.table, fields: b.fields }, { optional: entityExists }),
        step(2, "model", action, { entityPascal: b.entityPascal, fields: b.fields }, { optional: entityExists, dependsOn: [1] }),
        step(3, "apiController", action, { entityPascal: b.entityPascal }, { dependsOn: [2] }),
        step(4, "request", action, { entityPascal: b.entityPascal, fields: b.fields }, { dependsOn: [3] }),
        step(5, "apiRoute", action, { entityPascal: b.entityPascal, entityPlural: b.entityPlural, auth }, { dependsOn: [4] }),
        step(6, "test", action, { entityPascal: b.entityPascal, entitySnake: b.entitySnake, entityPlural: b.entityPlural, table: b.table, fields: b.fields, auth }, { dependsOn: [5] }),
      ]
    }
    case "add_relation":
      return relationSteps(intent)
    case "add_policy":
      return policySteps(intent)
    case "add_test":
      return [step(1, "test", action, { entityPascal: b.entityPascal, entitySnake: b.entitySnake, entityPlural: b.entityPlural, table: b.table, fields: b.fields })]
    case "enhance": {
      const file = entity ? `app/Http/Controllers/${b.entityPascal}.php` : undefined
      return [
        step(1, "analyze", action, { file, hint: intent.target, request: intent.raw }, { optional: true }),
        step(2, "suggest", action, { entity, target: intent.target, summary: intent.summary }, { dependsOn: [1] }),
      ]
    }
    case "fix_bug":
      return debugSteps(intent)
    case "debug":
      return debugSteps(intent)
  }
}

const RELATION_LABEL: Record<RelationType, string> = {
  hasMany: "一对多（hasMany）",
  belongsTo: "多对一（belongsTo）",
  belongsToMany: "多对多（belongsToMany）",
  hasOne: "一对一（hasOne）",
}

function buildSummary(intent: Intent, ctx: ProjectContext): string {
  const entity = intent.entity
  const b = derive(entity, intent.fields)
  const action = intent.action
  const entityExists = entity ? ctx.models.includes(b.entityPascal) : false
  const notes: string[] = []

  let text = ""
  switch (action) {
    case "create_feature":
      text = `将为 ${entity} 创建完整功能：迁移 → 模型 → 控制器 → 请求校验 → 路由 → 视图 → 测试（共 7 步）。`
      break
    case "create_crud":
      text = `将为 ${entity} 生成基础 CRUD：迁移 → 模型 → 控制器 → 请求校验 → 路由 → 测试（共 6 步）。`
      break
    case "create_api":
      text = `将为 ${entity} 创建 REST API：迁移 → 模型 → API 控制器 → 请求校验 → API 路由 → 测试（共 6 步）。`
      break
    case "add_relation": {
      const rel = intent.options.relation
      if (rel) {
        text = `将为 ${rel.on} 添加${RELATION_LABEL[rel.type]}关联：${rel.on} → ${rel.target}。`
        if (!ctx.models.includes(toPascalCase(rel.target))) {
          notes.push(`注意：关联目标 ${rel.target} 模型不存在，可能需要先创建。`)
        }
      } else {
        text = `将添加模型关系（未识别出两个实体）。`
      }
      break
    }
    case "add_policy":
      text = `将为 ${entity} 生成权限策略：policy 文件 → 注册 → 模型关联（共 3 步）。`
      break
    case "add_test":
      text = `将为 ${entity} 添加测试。`
      break
    case "enhance": {
      const target = intent.target ? `（${intent.target}）` : ""
      text = `将增强 ${entity || "现有功能"}${target}：定位 → 分析现有实现 → 输出修改建议（不新建文件，共 2 步）。`
      if (intent.summary) notes.push(`语义层说明：${intent.summary}`)
      break
    }
    case "fix_bug":
      text = `将修复 bug：定位 → 分析 → 诊断 → 建议（共 4 步）。`
      break
    case "debug":
      text = `将运行调试工作流：定位 → 分析 → 诊断 → 建议（共 4 步）。`
      break
  }

  if ((action === "create_feature" || action === "create_crud" || action === "create_api") && entityExists) {
    notes.push(`注意：${entity} 模型已存在，迁移/模型步骤将跳过已存在部分。`)
  }
  if (intent.options.auth === true) {
    if (action === "create_api") {
      notes.push(`路由将使用 auth:sanctum 保护。`)
    } else if (action === "create_feature") {
      notes.push(`需登录用户（auth:sanctum）访问。`)
    }
  } else if (action === "create_api") {
    notes.push(`项目未启用认证，API 路由将不保护。`)
  }

  return [text, ...notes].join("\n")
}

export async function makeFeaturePlan(
  intent: Intent,
  projectPath: string,
  loadContext: ContextLoader = (p) => contextManager.getContext(p),
): Promise<Plan> {
  const ctx = await loadContext(projectPath)
  const hasSanctum = ctx.packages.production.includes("laravel/sanctum")
  if (hasSanctum && intent.options.auth === undefined) {
    intent.options.auth = true
  }
  const steps = buildSteps(intent, ctx)
  const summary = buildSummary(intent, ctx)
  return { intent, steps, summary }
}
