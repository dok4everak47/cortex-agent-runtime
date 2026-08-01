import { describe, it } from "node:test"
import assert from "node:assert"
import type { IntentPlannerHandlerDeps, Intent } from "../planner/index.js"
import type { Plan } from "../planner/plan-schema.js"
import type { ProjectContext } from "../context/types.js"

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean }

function mockContext(overrides: Partial<ProjectContext> = {}): ProjectContext {
  return {
    laravel: {
      version: "11.x",
      phpVersion: "8.3",
      environment: "local",
      debug: true,
      database: { driver: "mysql", name: "blog" },
      framework: "Laravel",
    },
    app: { name: "Blog", url: "http://localhost" },
    models: ["Post", "User"],
    tables: ["posts", "users"],
    routes: { count: 5, named: [], groups: [] },
    packages: { production: ["laravel/framework", "laravel/sanctum"], dev: [] },
    frontend: [],
    structure: { controllers: 3, views: 4, migrations: 5, tests: 2 },
    builtAt: Date.now(),
    source: "mock",
    ...overrides,
  }
}

function makeDeps(overrides: Partial<IntentPlannerHandlerDeps> = {}): {
  deps: IntentPlannerHandlerDeps
  calls: string[]
} {
  const calls: string[] = []
  const deps: IntentPlannerHandlerDeps = {
    parseIntent: async (input: string): Promise<Intent> => ({
      action: "create_crud",
      entity: "Post",
      options: {},
      confidence: 0.95,
      raw: input,
    }),
    makePlan: async (intent: Intent): Promise<Plan> => ({
      intent,
      steps: [
        { step: 1, type: "migration", action: intent.action, params: { table: "posts" } },
        { step: 2, type: "model", action: intent.action, params: {} },
        { step: 3, type: "controller", action: intent.action, params: {} },
        { step: 4, type: "request", action: intent.action, params: {} },
        { step: 5, type: "route", action: intent.action, params: {} },
        { step: 6, type: "test", action: intent.action, params: {} },
      ],
      summary:
        "计划步骤（6 步）：migration → model → controller → request → route → test\n风险：route 步骤将修改现有 routes/web.php（追加资源路由，不覆盖已有内容）。",
    }),
    execute: async (intent: Intent) => {
      calls.push(`execute:${intent.action}`)
      return { runId: "20260801-000000-crud-Post", status: "success" }
    },
    getProjectPath: () => "/tmp/project",
    ...overrides,
  }
  return { deps, calls }
}

function parseResult(result: ToolResult): Record<string, unknown> {
  return JSON.parse(result.content[0].text)
}

describe("intentPlanner IntentGate", () => {
  it("dryRun=true → mode=plan, does not execute", async () => {
    const { handleIntentPlanner } = await import("../planner/index.js")
    const { deps, calls } = makeDeps()
    const result = parseResult(await handleIntentPlanner({ request: "Create a Post CRUD", dryRun: true }, deps))
    assert.equal(result.mode, "plan")
    assert.deepEqual(calls, [])
    assert.ok(typeof result.summary === "string")
  })

  it("dryRun defaults to true when omitted → mode=plan", async () => {
    const { handleIntentPlanner } = await import("../planner/index.js")
    const { deps, calls } = makeDeps()
    const result = parseResult(await handleIntentPlanner({ request: "Create a Post CRUD" }, deps))
    assert.equal(result.mode, "plan")
    assert.deepEqual(calls, [])
  })

  it("dryRun=false without confirmed → mode=awaiting_confirmation, does not execute", async () => {
    const { handleIntentPlanner } = await import("../planner/index.js")
    const { deps, calls } = makeDeps()
    const result = parseResult(await handleIntentPlanner({ request: "Create a Post CRUD", dryRun: false }, deps))
    assert.equal(result.mode, "awaiting_confirmation")
    assert.deepEqual(calls, [])
    assert.ok(typeof result.summary === "string")
    assert.ok(String(result.summary).includes("计划步骤"))
    assert.ok(String(result.nextStep).includes("confirmed=true"))
  })

  it("low-confidence intent also requires confirmation (unified safety gate)", async () => {
    const { handleIntentPlanner } = await import("../planner/index.js")
    const { deps, calls } = makeDeps({
      parseIntent: async (input: string): Promise<Intent> => ({
        action: "enhance",
        entity: "SearchController",
        options: {},
        confidence: 0.4,
        raw: input,
      }),
    })
    const result = parseResult(await handleIntentPlanner({ request: "增强博客搜索", dryRun: false }, deps))
    assert.equal(result.mode, "awaiting_confirmation")
    assert.deepEqual(calls, [])
  })

  it("dryRun=false with confirmed=true → mode=executed and executes", async () => {
    const { handleIntentPlanner } = await import("../planner/index.js")
    const { deps, calls } = makeDeps()
    const result = parseResult(
      await handleIntentPlanner({ request: "Create a Post CRUD", dryRun: false, confirmed: true }, deps),
    )
    assert.equal(result.mode, "executed")
    assert.deepEqual(calls, ["execute:create_crud"])
    assert.equal((result.executed as { runId: string }).runId, "20260801-000000-crud-Post")
  })

  it("create action without entity stays in plan mode even when confirmed", async () => {
    const { handleIntentPlanner } = await import("../planner/index.js")
    const { deps, calls } = makeDeps({
      parseIntent: async (input: string): Promise<Intent> => ({
        action: "create_crud",
        entity: "",
        options: {},
        confidence: 0.9,
        raw: input,
      }),
    })
    const result = parseResult(
      await handleIntentPlanner({ request: "生成 CRUD", dryRun: false, confirmed: true }, deps),
    )
    assert.equal(result.mode, "plan")
    assert.deepEqual(calls, [])
  })

  it("missing request returns an error", async () => {
    const { handleIntentPlanner } = await import("../planner/index.js")
    const { deps } = makeDeps()
    const result = await handleIntentPlanner({}, deps)
    assert.equal(result.isError, true)
  })
})

describe("intentPlanner summary", () => {
  it("summary lists step types and risky route modification", async () => {
    const { parseIntent } = await import("../planner/intent-parser.js")
    const { makeFeaturePlan } = await import("../planner/feature-planner.js")
    const plan = await makeFeaturePlan(parseIntent("给 Post 生成 CRUD"), "/tmp/x", async () => mockContext())
    assert.ok(plan.summary.includes("计划步骤"))
    assert.ok(plan.summary.includes("migration → model → controller → request → route → test"))
    assert.ok(plan.summary.includes("风险"))
    assert.ok(plan.summary.includes("routes/web.php"))
  })

  it("summary annotates skipped steps for existing tables", async () => {
    const { parseIntent } = await import("../planner/intent-parser.js")
    const { makeFeaturePlan } = await import("../planner/feature-planner.js")
    const ctx = mockContext({ models: ["Comment", "Post", "User"], tables: ["comments", "posts", "users"] })
    const plan = await makeFeaturePlan(parseIntent("给博客增加评论功能"), "/tmp/x", async () => ctx)
    assert.ok(plan.summary.includes("模型已存在"))
    assert.ok(plan.summary.includes("comments 表已存在"))
  })
})
