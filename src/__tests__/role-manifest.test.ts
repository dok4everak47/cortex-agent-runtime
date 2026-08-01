import { describe, it } from "node:test"
import assert from "node:assert"
import { ToolRegistry } from "../core/registry.js"
import { genericDomain } from "../domains/generic/manifest.js"
import { laravelDomain } from "../domains/laravel/manifest.js"

describe("RoleManifest", () => {
  it("generic declares an explorer role with correct tool bindings", () => {
    const roles = genericDomain.roles ?? []
    const explorer = roles.find((r) => r.id === "explorer")
    assert.ok(explorer, "explorer role should be declared")
    assert.equal(explorer.name, "探索者")
    assert.equal(typeof explorer.description, "string")
    assert.deepEqual(explorer.tools, ["gitStatus", "fileSearch", "projectTree"])
  })

  it("laravel declares engineer and maintainer roles without dangling tool references", () => {
    const registry = new ToolRegistry()
    registry.registerDomain(laravelDomain)
    const registered = new Set(registry.listTools().map((t) => t.name))

    const roles = laravelDomain.roles ?? []
    const ids = roles.map((r) => r.id)
    assert.ok(ids.includes("engineer"))
    assert.ok(ids.includes("maintainer"))

    for (const role of roles) {
      assert.ok(role.tools.length > 0, `role ${role.id} should bind at least one tool`)
      for (const tool of role.tools) {
        assert.ok(registered.has(tool), `role ${role.id} references unregistered tool '${tool}'`)
      }
    }
  })

  it("listRoles aggregates roles from all domains and dedupes by id", () => {
    const registry = new ToolRegistry()
    registry.registerDomain(genericDomain)
    registry.registerDomain(laravelDomain)
    const roles = registry.listRoles()
    const ids = roles.map((r) => r.id).sort()
    assert.deepEqual(ids, ["engineer", "explorer", "maintainer"])
  })

  it("listRoles merges tools for roles with the same id", () => {
    const registry = new ToolRegistry()
    registry.registerDomain({ ...genericDomain, roles: [{ id: "explorer", name: "探索者", description: "x", tools: ["gitStatus"] }] })
    registry.registerDomain(genericDomain)
    const explorer = registry.listRoles().find((r) => r.id === "explorer")
    assert.ok(explorer)
    assert.deepEqual(explorer.tools.sort(), ["fileSearch", "gitStatus", "projectTree"])
  })

  it("getRoleTools returns the bound tool list", () => {
    const registry = new ToolRegistry()
    registry.registerDomain(laravelDomain)
    const tools = registry.getRoleTools("engineer")
    assert.ok(tools.includes("artisan"))
    assert.ok(tools.includes("schema"))
    assert.ok(tools.includes("projectContext"))
    assert.equal(registry.getRoleTools("doesNotExist").length, 0)
  })

  it("listRoles MCP tool returns valid JSON for a multi-domain registry", async () => {
    const registry = new ToolRegistry()
    registry.registerDomain(genericDomain)
    registry.registerDomain(laravelDomain)
    const result = await registry.callTool("listRoles", {})
    assert.equal(result.isError, false)
    const parsed = JSON.parse(result.content[0].text)
    assert.ok(Array.isArray(parsed))
    const ids = parsed.map((r: { id: string }) => r.id).sort()
    assert.deepEqual(ids, ["engineer", "explorer", "maintainer"])
    const engineer = parsed.find((r: { id: string }) => r.id === "engineer") as { tools: string[] }
    assert.ok(engineer.tools.includes("artisan"))
  })
})
