import { describe, it } from "node:test"
import assert from "node:assert"
import { ToolRegistry } from "../core/registry.js"
import { genericDomain } from "../domains/generic/manifest.js"
import { laravelDomain } from "../domains/laravel/manifest.js"

describe("ToolRegistry", () => {
  it("merges tools and handlers from multiple domains", () => {
    const registry = new ToolRegistry()
    registry.registerDomain(genericDomain)
    registry.registerDomain(laravelDomain)

    const names = registry.listTools().map((t) => t.name)
    assert.ok(names.includes("gitStatus"))
    assert.ok(names.includes("fileSearch"))
    assert.ok(names.includes("projectTree"))
    assert.ok(names.includes("artisan"))
    assert.ok(names.includes("migrateStatus"))
    assert.ok(registry.getHandlers()["gitStatus"])
    assert.ok(registry.getHandlers()["artisan"])
  })

  it("does not duplicate a tool registered twice", () => {
    const registry = new ToolRegistry()
    registry.registerDomain(genericDomain)
    registry.registerDomain(genericDomain)
    assert.equal(registry.listTools().length, 3)
  })

  it("returns an error for unknown tools", async () => {
    const registry = new ToolRegistry()
    registry.registerDomain(genericDomain)
    const result = await registry.callTool("doesNotExist", {})
    assert.equal(result.isError, true)
    assert.ok(result.content[0].text.includes("Unknown tool"))
  })

  it("dispatches a known generic tool", async () => {
    const registry = new ToolRegistry()
    registry.registerDomain(genericDomain)
    const result = await registry.callTool("fileSearch", { pattern: "nope-*.xyz" })
    assert.equal(result.isError, false)
  })

  it("listTools() and callTool() module helpers delegate to the default registry", async () => {
    const { listTools, callTool } = await import("../core/registry.js")
    const names = listTools().map((t) => t.name)
    assert.ok(names.includes("artisan"))
    const result = await callTool("doesNotExist", {})
    assert.equal(result.isError, true)
  })
})
