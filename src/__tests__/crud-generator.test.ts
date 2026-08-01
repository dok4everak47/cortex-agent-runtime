import { describe, it } from "node:test"
import assert from "node:assert"

describe("crudGenerator", () => {
  it("returns error for missing entity", async () => {
    const mod = await import("../domains/laravel/workflows/crud-generator.js")
    const result = await mod.executeCrudGenerator({})
    assert.ok(result.isError)
    assert.ok(result.content[0].text.includes("entity"))
  })

  it("returns error for empty entity", async () => {
    const mod = await import("../domains/laravel/workflows/crud-generator.js")
    const result = await mod.executeCrudGenerator({ entity: "" })
    assert.ok(result.isError)
    assert.ok(result.content[0].text.includes("entity"))
  })

  it("handles non-existent laravel project gracefully", async () => {
    const mod = await import("../domains/laravel/workflows/crud-generator.js")

    const origPath = process.env.LARAVEL_PROJECT_PATH
    process.env.LARAVEL_PROJECT_PATH = "/tmp/non-existent-project-xxxx"

    try {
      const result = await mod.executeCrudGenerator({ entity: "Post", fields: "title:string,content:text" })
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
