import { describe, it } from "node:test"
import assert from "node:assert"
import type { IntentPlannerDeps } from "../planner/index.js"
import type { ProjectContext } from "../context/types.js"

function mockContext(): ProjectContext {
  return {
    laravel: {
      version: "11.x",
      phpVersion: "8.3",
      environment: "local",
      debug: true,
      database: { driver: "postgres", name: "blog" },
      framework: "Laravel",
    },
    app: { name: "Blog", url: "http://localhost" },
    models: ["Post", "Category", "User"],
    tables: ["posts", "categories", "users"],
    routes: { count: 47, named: ["posts.index"], groups: ["web"] },
    packages: { production: ["laravel/framework", "laravel/sanctum"], dev: [] },
    frontend: [],
    structure: { controllers: 3, views: 4, migrations: 5, tests: 2 },
    builtAt: Date.now(),
    source: "mock",
  }
}

function llmDeps(overrides: Partial<IntentPlannerDeps> = {}): {
  deps: IntentPlannerDeps
  analyzeCalls: string[]
} {
  const analyzeCalls: string[] = []
  const deps: IntentPlannerDeps = {
    getLLMConfig: () => ({
      apiKey: "sk-test",
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      enabled: true,
    }),
    analyzeIntent: async (request: string) => {
      analyzeCalls.push(request)
      return {
        action: "enhance",
        entity: "SearchController",
        target: "search",
        options: { views: false, api: false, auth: false },
        confidence: 0.95,
        raw: request,
        summary: "用 PostgreSQL 全文搜索替代 LIKE，支持相关度排序",
      }
    },
    loadContext: async () => mockContext(),
    ...overrides,
  }
  return { deps, analyzeCalls }
}

describe("parseIntent two-stage routing", () => {
  it("returns the rule-based result directly when confidence >= 0.8 (no LLM call)", async () => {
    const { parseIntent } = await import("../planner/index.js")
    const { deps, analyzeCalls } = llmDeps()
    const intent = await parseIntent("Create a Post CRUD", "/tmp/project", deps)
    assert.equal(intent.action, "create_crud")
    assert.equal(intent.entity, "Post")
    assert.ok(intent.confidence >= 0.8)
    assert.deepEqual(analyzeCalls, [])
  })

  it("uses the LLM result for low-confidence requests when LLM is enabled", async () => {
    const { parseIntent } = await import("../planner/index.js")
    const { deps, analyzeCalls } = llmDeps()
    const intent = await parseIntent("增强博客的文章搜索功能", "/tmp/project", deps)
    assert.equal(intent.action, "enhance")
    assert.equal(intent.entity, "SearchController")
    assert.equal(intent.target, "search")
    assert.ok(intent.summary?.includes("全文搜索"))
    assert.deepEqual(analyzeCalls, ["增强博客的文章搜索功能"])
  })

  it("passes the loaded project context into the LLM analyzer", async () => {
    const { parseIntent } = await import("../planner/index.js")
    let received: unknown = null
    const { deps } = llmDeps({
      loadContext: async () => mockContext(),
      analyzeIntent: async (request: string, context: unknown) => {
        received = context
        return null
      },
    })
    await parseIntent("增强博客的文章搜索功能", "/tmp/project", deps)
    assert.deepEqual(received, mockContext())
  })

  it("falls back to the rule-based result with a hint when LLM is disabled", async () => {
    const { parseIntent } = await import("../planner/index.js")
    const { deps, analyzeCalls } = llmDeps({
      getLLMConfig: () => ({
        apiKey: "",
        baseUrl: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
        enabled: false,
      }),
    })
    const intent = await parseIntent("增强博客的文章搜索功能", "/tmp/project", deps)
    assert.ok(intent.confidence < 0.8)
    assert.ok(intent.summary?.includes("LLM_API_KEY"))
    assert.deepEqual(analyzeCalls, [])
  })

  it("falls back to the rule-based result when the LLM analyzer fails", async () => {
    const { parseIntent } = await import("../planner/index.js")
    const { deps, analyzeCalls } = llmDeps({
      analyzeIntent: async () => {
        analyzeCalls.push("called")
        throw new Error("api down")
      },
    })
    const intent = await parseIntent("增强博客的文章搜索功能", "/tmp/project", deps)
    assert.ok(intent.summary?.includes("LLM_API_KEY"))
    assert.deepEqual(analyzeCalls, ["called"])
  })

  it("skips the LLM when no project path is provided", async () => {
    const { parseIntent } = await import("../planner/index.js")
    const { deps, analyzeCalls } = llmDeps()
    const intent = await parseIntent("增强博客的文章搜索功能", undefined, deps)
    assert.ok(intent.summary?.includes("LLM_API_KEY"))
    assert.deepEqual(analyzeCalls, [])
  })
})
