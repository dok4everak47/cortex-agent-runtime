import { describe, it } from "node:test"
import assert from "node:assert"
import { executeMakeModel } from "../tools/make-model.js"
import { executeMakeController } from "../tools/make-controller.js"
import { executeMakeMigration } from "../tools/make-migration.js"

describe("makeModel", () => {
  it("returns error for missing name", () => {
    const result = executeMakeModel({})
    assert.ok(result.content[0].text.includes("Error"))
  })

  it("returns error for empty name", () => {
    const result = executeMakeModel({ name: "" })
    assert.ok(result.content[0].text.includes("Error"))
  })

  it("accepts name only (no flags)", () => {
    // This will call runArtisan → execSync which will fail gracefully
    // because PHP is not available in test environment
    const result = executeMakeModel({ name: "TestModel" })
    // The output will be an error from execSync (no PHP) — not a "required" error
    assert.ok(!result.content[0].text.includes("Error: 'name' argument is required"))
  })
})

describe("makeController", () => {
  it("returns error for missing name", () => {
    const result = executeMakeController({})
    assert.ok(result.content[0].text.includes("Error"))
  })

  it("returns error for empty name", () => {
    const result = executeMakeController({ name: "" })
    assert.ok(result.content[0].text.includes("Error"))
  })

  it("accepts name with resource flag", () => {
    const result = executeMakeController({ name: "PostController", resource: true })
    assert.ok(!result.content[0].text.includes("Error: 'name' argument is required"))
  })

  it("accepts name with api + model flags", () => {
    const result = executeMakeController({ name: "ApiController", resource: true, api: true, model: "Post" })
    assert.ok(!result.content[0].text.includes("Error: 'name' argument is required"))
  })
})

describe("makeMigration", () => {
  it("returns error for missing name", () => {
    const result = executeMakeMigration({})
    assert.ok(result.content[0].text.includes("Error"))
  })

  it("returns error for empty name", () => {
    const result = executeMakeMigration({ name: "" })
    assert.ok(result.content[0].text.includes("Error"))
  })

  it("accepts name with create flag", () => {
    const result = executeMakeMigration({ name: "create_posts_table", create: true })
    assert.ok(!result.content[0].text.includes("Error: 'name' argument is required"))
  })

  it("accepts name with table flag", () => {
    const result = executeMakeMigration({ name: "add_title_to_posts", table: "posts" })
    assert.ok(!result.content[0].text.includes("Error: 'name' argument is required"))
  })
})
