import { describe, it } from "node:test"
import assert from "node:assert"

// We test the module indirectly through the exported executeCrudGenerator
// and also test internal helpers via module-level access

// Since parseFields, pluralize, snakeCase, toPascalCase are not exported,
// we test them through the public executeCrudGenerator function

describe("crudGenerator", () => {
  it("returns error for missing entity", async () => {
    // Dynamic import to avoid needing a real Laravel project
    const mod = await import("../tools/crud-generator.js")
    const result = mod.executeCrudGenerator({})
    assert.ok(result.isError)
    assert.ok(result.content[0].text.includes("entity"))
  })

  it("returns error for empty entity", async () => {
    const mod = await import("../tools/crud-generator.js")
    const result = mod.executeCrudGenerator({ entity: "" })
    assert.ok(result.isError)
    assert.ok(result.content[0].text.includes("entity"))
  })

  it("handles non-existent laravel project gracefully", async () => {
    const mod = await import("../tools/crud-generator.js")

    // Backup and override env
    const origPath = process.env.LARAVEL_PROJECT_PATH
    process.env.LARAVEL_PROJECT_PATH = "/tmp/non-existent-project-xxxx"

    try {
      const result = mod.executeCrudGenerator({ entity: "Post", fields: "title:string,content:text" })
      // Should still return content (not throw), with steps
      const parsed = JSON.parse(result.content[0].text)
      assert.ok(Array.isArray(parsed.steps))
      assert.equal(parsed.steps.length, 7)
      // All steps should have status (skipped/failed since no project)
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
