import { describe, it } from "node:test"
import assert from "node:assert"
import type { ProjectContext } from "../context/types.js"

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

describe("makeFeaturePlan", () => {
  it("builds a 7-step create_feature plan", async () => {
    const { parseIntent } = await import("../planner/intent-parser.js")
    const { makeFeaturePlan } = await import("../planner/feature-planner.js")
    const plan = await makeFeaturePlan(parseIntent("给博客增加评论功能"), "/tmp/x", async () => mockContext())
    assert.deepEqual(
      plan.steps.map((s) => s.type),
      ["migration", "model", "controller", "request", "route", "views", "test"],
    )
    assert.equal(plan.steps.length, 7)
    assert.ok(plan.summary.includes("Comment"))
    assert.ok(plan.summary.includes("auth:sanctum"))
  })

  it("builds a 6-step create_crud plan", async () => {
    const { parseIntent } = await import("../planner/intent-parser.js")
    const { makeFeaturePlan } = await import("../planner/feature-planner.js")
    const plan = await makeFeaturePlan(parseIntent("给 Post 生成 CRUD"), "/tmp/x", async () => mockContext())
    assert.deepEqual(
      plan.steps.map((s) => s.type),
      ["migration", "model", "controller", "request", "route", "test"],
    )
    assert.equal(plan.steps.length, 6)
    const migration = plan.steps[0].params
    assert.equal(migration.table, "posts")
  })

  it("builds a create_api plan with auth when sanctum is installed", async () => {
    const { parseIntent } = await import("../planner/intent-parser.js")
    const { makeFeaturePlan } = await import("../planner/feature-planner.js")
    const plan = await makeFeaturePlan(parseIntent("为 Tag 创建 REST API"), "/tmp/x", async () => mockContext())
    assert.deepEqual(
      plan.steps.map((s) => s.type),
      ["migration", "model", "apiController", "request", "apiRoute", "test"],
    )
    assert.equal(plan.steps[4].params.auth, true)
    assert.equal(plan.intent.options.auth, true)
    assert.ok(plan.summary.includes("auth:sanctum"))
  })

  it("does not enable auth for create_api without sanctum", async () => {
    const { parseIntent } = await import("../planner/intent-parser.js")
    const { makeFeaturePlan } = await import("../planner/feature-planner.js")
    const ctx = mockContext({ packages: { production: ["laravel/framework"], dev: [] } })
    const plan = await makeFeaturePlan(parseIntent("为 Tag 创建 REST API"), "/tmp/x", async () => ctx)
    assert.equal(plan.steps[4].params.auth, false)
    assert.ok(plan.summary.includes("不保护"))
  })

  it("builds an add_relation plan with a foreign key migration", async () => {
    const { parseIntent } = await import("../planner/intent-parser.js")
    const { makeFeaturePlan } = await import("../planner/feature-planner.js")
    const plan = await makeFeaturePlan(parseIntent("Post 和 User 建立多对多关系"), "/tmp/x", async () => mockContext())
    assert.deepEqual(
      plan.steps.map((s) => s.type),
      ["migration", "model"],
    )
    const fields = plan.steps[0].params.fields as { name: string; type: string }[]
    assert.deepEqual(fields, [{ name: "user_id", type: "foreignId" }])
    assert.equal(plan.intent.options.relation?.type, "belongsToMany")
    assert.ok(plan.summary.includes("多对多"))
  })

  it("warns when the relation target model does not exist", async () => {
    const { parseIntent } = await import("../planner/intent-parser.js")
    const { makeFeaturePlan } = await import("../planner/feature-planner.js")
    const ctx = mockContext({ models: ["Post"] })
    const plan = await makeFeaturePlan(parseIntent("Post 和 User 建立多对多关系"), "/tmp/x", async () => ctx)
    assert.ok(plan.summary.includes("User 模型不存在"))
  })

  it("warns when the entity already exists", async () => {
    const { parseIntent } = await import("../planner/intent-parser.js")
    const { makeFeaturePlan } = await import("../planner/feature-planner.js")
    const ctx = mockContext({ models: ["Comment", "Post", "User"] })
    const plan = await makeFeaturePlan(parseIntent("给博客增加评论功能"), "/tmp/x", async () => ctx)
    assert.ok(plan.summary.includes("模型已存在"))
    assert.equal(plan.steps[0].optional, true)
  })

  it("builds a 4-step debug plan", async () => {
    const { parseIntent } = await import("../planner/intent-parser.js")
    const { makeFeaturePlan } = await import("../planner/feature-planner.js")
    const plan = await makeFeaturePlan(parseIntent("这个报错怎么解决"), "/tmp/x", async () => mockContext())
    assert.deepEqual(
      plan.steps.map((s) => s.type),
      ["locate", "analyze", "diagnose", "suggest"],
    )
  })

  it("builds an add_policy plan", async () => {
    const { parseIntent } = await import("../planner/intent-parser.js")
    const { makeFeaturePlan } = await import("../planner/feature-planner.js")
    const plan = await makeFeaturePlan(parseIntent("给 Comment 加权限"), "/tmp/x", async () => mockContext())
    assert.deepEqual(
      plan.steps.map((s) => s.type),
      ["policy", "registerPolicy", "model"],
    )
  })
})
