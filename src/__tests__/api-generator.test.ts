import { describe, it } from "node:test"
import assert from "node:assert"

describe("apiGenerator", () => {
  it("returns error for missing entity", async () => {
    const mod = await import("../domains/laravel/workflows/api-generator.js")
    const result = await mod.executeApiGenerator({})
    assert.ok(result.isError)
    assert.ok(result.content[0].text.includes("entity"))
  })

  it("makeApiPlan produces six steps with api steps", async () => {
    const { makeApiPlan } = await import("../domains/laravel/workflows/api/planner.js")
    const plan = makeApiPlan("Tag", "name:string", true)
    assert.equal(plan.length, 6)
    assert.deepEqual(plan.map(p => p.type), [
      "migration", "model", "apiController", "request", "apiRoute", "test",
    ])
    const apiRoute = plan[4].params
    assert.equal(apiRoute.entityPlural, "tags")
    assert.equal(apiRoute.auth, true)
    const testParams = plan[5].params
    assert.equal(testParams.auth, true)
    assert.equal(testParams.table, "tags")
  })

  it("generateApiTestContent builds JSON feature tests", async () => {
    const { generateApiTestContent } = await import("../domains/laravel/workflows/api/steps/test.js")
    const content = generateApiTestContent("Tag", "tag", "tags", [{ name: "name", type: "string" }], false, [])
    assert.ok(content.includes("class TagApiTest extends TestCase"))
    assert.ok(content.includes("getJson('/api/tags')"))
    assert.ok(content.includes("postJson('/api/tags'"))
    assert.ok(content.includes("assertStatus(201)"))
    assert.ok(content.includes("assertNoContent()"))
    assert.ok(content.includes("'name' => 'Test name'"))
    assert.ok(!content.includes("Sanctum"))
  })

  it("generateApiTestContent adds sanctum auth when auth=true", async () => {
    const { generateApiTestContent } = await import("../domains/laravel/workflows/api/steps/test.js")
    const content = generateApiTestContent("Tag", "tag", "tags", [{ name: "name", type: "string" }], true, [])
    assert.ok(content.includes("use Laravel\\Sanctum\\Sanctum;"))
    assert.ok(content.includes("Sanctum::actingAs($user);"))
    assert.ok(content.includes("use App\\Models\\User;"))
  })

  it("handles non-existent laravel project gracefully", async () => {
    const mod = await import("../domains/laravel/workflows/api-generator.js")
    const origPath = process.env.LARAVEL_PROJECT_PATH
    process.env.LARAVEL_PROJECT_PATH = "/tmp/non-existent-project-api-xxxx"

    try {
      const result = await mod.executeApiGenerator({ entity: "Tag", fields: "name:string", auth: true })
      const parsed = JSON.parse(result.content[0].text)
      assert.ok(Array.isArray(parsed.steps))
      assert.equal(parsed.steps.length, 6)
      parsed.steps.forEach((s: { step: number; status: string }) => {
        assert.ok(["skipped", "failed", "done"].includes(s.status))
      })
      assert.ok(parsed.summary)
    } finally {
      if (origPath) {
        process.env.LARAVEL_PROJECT_PATH = origPath
      } else {
        delete process.env.LARAVEL_PROJECT_PATH
      }
    }
  })
})
