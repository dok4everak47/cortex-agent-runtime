import { describe, it } from "node:test"
import assert from "node:assert"
import type { Intent, Plan, PlannedAction, PlanStep, RelationType } from "../domains/laravel/planner/plan-schema.js"

const ALL_ACTIONS: PlannedAction[] = [
  "create_feature",
  "create_crud",
  "create_api",
  "add_relation",
  "add_policy",
  "add_test",
  "debug",
]

const RELATION_TYPES: RelationType[] = ["hasMany", "belongsTo", "belongsToMany", "hasOne"]

function mockContext() {
  return {
    laravel: { version: "11.x", phpVersion: "8.3", environment: "local", debug: true, database: { driver: "mysql", name: "blog" }, framework: "Laravel" },
    app: { name: "Blog", url: "http://localhost" },
    models: ["Post", "User"],
    tables: ["posts", "users"],
    routes: { count: 5, named: [], groups: [] },
    packages: { production: ["laravel/framework", "laravel/sanctum"], dev: [] },
    frontend: [],
    structure: { controllers: 3, views: 4, migrations: 5, tests: 2 },
    builtAt: Date.now(),
    source: "mock",
  }
}

describe("plan-schema", () => {
  it("exports the full set of planned actions", async () => {
    const mod = await import("../domains/laravel/planner/plan-schema.js")
    assert.ok(mod)
    const { parseIntent } = await import("../domains/laravel/planner/intent-parser.js")
    const parsed: PlannedAction[] = ALL_ACTIONS.map((action) => {
      const input =
        action === "debug"
          ? "这个报错怎么解决"
          : action === "add_relation"
            ? "Post 和 User 建立多对多关系"
            : action === "add_policy"
              ? "给 Comment 加权限"
              : action === "add_test"
                ? "给 Comment 加测试"
                : action === "create_api"
                  ? "为 Tag 创建 REST API"
                  : action === "create_crud"
                    ? "给 Post 生成 CRUD"
                    : "给博客增加评论功能"
      const intent: Intent = parseIntent(input)
      return intent.action
    })
    assert.deepEqual(parsed, ALL_ACTIONS)
  })

  it("produces PlanSteps with valid shape and dependencies", async () => {
    const { parseIntent } = await import("../domains/laravel/planner/intent-parser.js")
    const { makeFeaturePlan } = await import("../domains/laravel/planner/feature-planner.js")
    const plan: Plan = await makeFeaturePlan(parseIntent("给博客增加评论功能"), "/tmp/x", async () => mockContext())

    plan.steps.forEach((s: PlanStep, idx: number) => {
      assert.equal(s.step, idx + 1)
      assert.equal(s.action, "create_feature")
      assert.ok(typeof s.type === "string" && s.type.length > 0)
      assert.ok(typeof s.params === "object" && s.params !== null)
      if (idx > 0) assert.deepEqual(s.dependsOn, [idx])
    })
  })

  it("constrains relation types to the schema set", async () => {
    const { parseIntent } = await import("../domains/laravel/planner/intent-parser.js")
    const intent: Intent = parseIntent("Post 和 User 建立多对多关系")
    assert.ok(intent.options.relation)
    assert.ok(RELATION_TYPES.includes(intent.options.relation.type))
  })

  it("marks each action with a confidence in [0,1]", async () => {
    const { parseIntent } = await import("../domains/laravel/planner/intent-parser.js")
    for (const input of ["给博客增加评论功能", "给 Post 生成 CRUD", "为 Tag 创建 REST API", "这个报错怎么解决"]) {
      const intent: Intent = parseIntent(input)
      assert.ok(intent.confidence >= 0 && intent.confidence <= 1)
    }
  })
})
