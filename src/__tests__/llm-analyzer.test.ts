import { describe, it, mock, afterEach } from "node:test"
import assert from "node:assert"
import type { ProjectContext } from "../domains/laravel/context/types.js"

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
    frontend: ["blade"],
    structure: { controllers: 3, views: 4, migrations: 5, tests: 2 },
    builtAt: Date.now(),
    source: "mock",
  }
}

function llmResponse(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })
}

describe("getLLMConfig", () => {
  afterEach(() => {
    delete process.env.LLM_API_KEY
    delete process.env.LLM_BASE_URL
    delete process.env.LLM_MODEL
    mock.restoreAll()
  })

  it("defaults to disabled and DeepSeek when no env is set", async () => {
    const { getLLMConfig } = await import("../domains/laravel/planner/llm-analyzer.js")
    const cfg = getLLMConfig()
    assert.equal(cfg.enabled, false)
    assert.equal(cfg.apiKey, "")
    assert.equal(cfg.baseUrl, "https://api.deepseek.com/v1")
    assert.equal(cfg.model, "deepseek-chat")
  })

  it("is enabled when LLM_API_KEY is set", async () => {
    process.env.LLM_API_KEY = "sk-test"
    process.env.LLM_BASE_URL = "https://api.openai.com/v1"
    process.env.LLM_MODEL = "gpt-4o-mini"
    const { getLLMConfig } = await import("../domains/laravel/planner/llm-analyzer.js")
    const cfg = getLLMConfig()
    assert.equal(cfg.enabled, true)
    assert.equal(cfg.baseUrl, "https://api.openai.com/v1")
    assert.equal(cfg.model, "gpt-4o-mini")
  })
})

describe("analyzeIntent", () => {
  afterEach(() => {
    delete process.env.LLM_API_KEY
    delete process.env.LLM_BASE_URL
    delete process.env.LLM_MODEL
    mock.restoreAll()
  })

  it("returns null without calling the API when disabled", async () => {
    let called = false
    mock.method(globalThis, "fetch", async () => {
      called = true
      return llmResponse("{}")
    })
    const { analyzeIntent } = await import("../domains/laravel/planner/llm-analyzer.js")
    const result = await analyzeIntent("给博客加评论功能", mockContext())
    assert.equal(result, null)
    assert.equal(called, false)
  })

  it("parses a valid LLM JSON response into an Intent", async () => {
    process.env.LLM_API_KEY = "sk-test"
    mock.method(globalThis, "fetch", async (_url: unknown, init: { body?: string }) => {
      assert.ok(String(init?.body ?? "").includes("增强博客的文章搜索功能"))
      return llmResponse(
        JSON.stringify({
          action: "enhance",
          entity: "SearchController",
          target: "search",
          fields: null,
          options: { views: false, api: false, auth: false },
          summary: "用 PostgreSQL 全文搜索替代 LIKE，支持相关度排序",
        }),
      )
    })
    const { analyzeIntent } = await import("../domains/laravel/planner/llm-analyzer.js")
    const result = await analyzeIntent("增强博客的文章搜索功能，用全文搜索替代 LIKE", mockContext())
    assert.ok(result)
    assert.equal(result!.action, "enhance")
    assert.equal(result!.entity, "SearchController")
    assert.equal(result!.target, "search")
    assert.equal(result!.options.views, false)
    assert.equal(result!.summary, "用 PostgreSQL 全文搜索替代 LIKE，支持相关度排序")
    assert.ok(result!.confidence > 0.8)
    assert.equal(result!.raw, "增强博客的文章搜索功能，用全文搜索替代 LIKE")
  })

  it("strips markdown code fences from the response", async () => {
    process.env.LLM_API_KEY = "sk-test"
    mock.method(globalThis, "fetch", async () => llmResponse("```json\n{\"action\":\"fix_bug\",\"entity\":\"NoteController\",\"summary\":\"修复保存异常\"}\n```"))
    const { analyzeIntent } = await import("../domains/laravel/planner/llm-analyzer.js")
    const result = await analyzeIntent("修复文章保存异常", mockContext())
    assert.ok(result)
    assert.equal(result!.action, "fix_bug")
    assert.equal(result!.entity, "NoteController")
  })

  it("forces api options for create_api", async () => {
    process.env.LLM_API_KEY = "sk-test"
    mock.method(globalThis, "fetch", async () => llmResponse(JSON.stringify({ action: "create_api", entity: "Post" })))
    const { analyzeIntent } = await import("../domains/laravel/planner/llm-analyzer.js")
    const result = await analyzeIntent("为 Post 做 API", mockContext())
    assert.ok(result)
    assert.equal(result!.action, "create_api")
    assert.equal(result!.options.api, true)
    assert.equal(result!.options.views, false)
  })

  it("returns null when the response is not valid JSON", async () => {
    process.env.LLM_API_KEY = "sk-test"
    mock.method(globalThis, "fetch", async () => llmResponse("this is not json"))
    const { analyzeIntent } = await import("../domains/laravel/planner/llm-analyzer.js")
    const result = await analyzeIntent("随便写点东西", mockContext())
    assert.equal(result, null)
  })

  it("returns null when fetch rejects", async () => {
    process.env.LLM_API_KEY = "sk-test"
    mock.method(globalThis, "fetch", async () => {
      throw new Error("network down")
    })
    const { analyzeIntent } = await import("../domains/laravel/planner/llm-analyzer.js")
    const result = await analyzeIntent("随便写点东西", mockContext())
    assert.equal(result, null)
  })

  it("returns null when the HTTP status is not ok", async () => {
    process.env.LLM_API_KEY = "sk-test"
    mock.method(globalThis, "fetch", async () => new Response("{}", { status: 401 }))
    const { analyzeIntent } = await import("../domains/laravel/planner/llm-analyzer.js")
    const result = await analyzeIntent("随便写点东西", mockContext())
    assert.equal(result, null)
  })

  it("returns null when the LLM action is not allowed", async () => {
    process.env.LLM_API_KEY = "sk-test"
    mock.method(globalThis, "fetch", async () => llmResponse(JSON.stringify({ action: "drop_database" })))
    const { analyzeIntent } = await import("../domains/laravel/planner/llm-analyzer.js")
    const result = await analyzeIntent("删库", mockContext())
    assert.equal(result, null)
  })

  it("includes project context in the request body", async () => {
    process.env.LLM_API_KEY = "sk-test"
    mock.method(globalThis, "fetch", async (_url: unknown, init: { body?: string }) => {
      const body = String(init?.body ?? "")
      assert.ok(body.includes("Post"))
      assert.ok(body.includes("模型"))
      return llmResponse(JSON.stringify({ action: "debug", entity: "" }))
    })
    const { analyzeIntent } = await import("../domains/laravel/planner/llm-analyzer.js")
    const result = await analyzeIntent("这个报错怎么解决", mockContext())
    assert.ok(result)
    assert.equal(result!.action, "debug")
  })
})
