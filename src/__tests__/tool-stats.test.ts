import { describe, it } from "node:test"
import assert from "node:assert"
import { ToolRegistry, type DomainManifest, type ToolDefinition, type ToolHandler } from "../core/registry.js"

function makeFakeDomain(): DomainManifest {
  const defs: ToolDefinition[] = [
    { name: "alpha", description: "alpha tool", inputSchema: { type: "object", properties: {}, required: [] } },
    { name: "beta", description: "beta tool", inputSchema: { type: "object", properties: {}, required: [] } },
  ]
  const handlers: Record<string, ToolHandler> = {
    alpha: () => ({ content: [{ type: "text", text: "ok" }], isError: false }),
    beta: () => ({ content: [{ type: "text", text: "ok" }], isError: false }),
  }
  return {
    id: "fake",
    name: "Fake",
    description: "fake domain",
    detect: () => true,
    getTools: () => defs,
    getHandlers: () => handlers,
  }
}

describe("ToolRegistry stats", () => {
  it("records calls, avg duration and lastCalledAt", async () => {
    const registry = new ToolRegistry()
    registry.registerDomain(makeFakeDomain())
    await registry.callTool("alpha", {})
    await registry.callTool("alpha", {})
    await registry.callTool("beta", {})

    const report = registry.getToolStats()
    assert.equal(report.totalCalls, 3)
    const alpha = report.tools.find((t) => t.name === "alpha")
    const beta = report.tools.find((t) => t.name === "beta")
    assert.ok(alpha, "alpha should be listed")
    assert.ok(beta, "beta should be listed")
    assert.equal(alpha.calls, 2)
    assert.equal(beta.calls, 1)
    assert.equal(typeof alpha.avgDurationMs, "number")
    assert.ok(alpha.avgDurationMs >= 0)
    assert.ok(alpha.lastCalledAt > 0)
    assert.ok(alpha.lastCalledAt <= Date.now())
  })

  it("does not list tools that were never called", async () => {
    const registry = new ToolRegistry()
    registry.registerDomain(makeFakeDomain())
    await registry.callTool("alpha", {})
    const report = registry.getToolStats()
    assert.ok(report.tools.some((t) => t.name === "alpha"))
    assert.ok(!report.tools.some((t) => t.name === "beta"), "uncalled tool should not be listed")
    assert.equal(report.totalCalls, 1)
  })

  it("resetToolStats clears all counters", async () => {
    const registry = new ToolRegistry()
    registry.registerDomain(makeFakeDomain())
    await registry.callTool("alpha", {})
    registry.resetToolStats()
    const report = registry.getToolStats()
    assert.equal(report.totalCalls, 0)
    assert.deepEqual(report.tools, [])
  })
})

describe("executeToolStats", () => {
  it("returns valid JSON with tools and totalCalls", async () => {
    const { registry } = await import("../core/registry.js")
    const { executeToolStats } = await import("../core/tools/tool-stats.js")
    registry.resetToolStats()
    registry.registerDomain(makeFakeDomain())
    await registry.callTool("alpha", {})

    const result = await executeToolStats({})
    assert.equal(result.isError, false)
    const parsed = JSON.parse(result.content[0].text)
    assert.ok(Array.isArray(parsed.tools))
    assert.equal(typeof parsed.totalCalls, "number")
    assert.equal(parsed.totalCalls, 1)
    assert.equal(parsed.tools[0].name, "alpha")
  })

  it("reset:true clears stats before returning", async () => {
    const { registry } = await import("../core/registry.js")
    const { executeToolStats } = await import("../core/tools/tool-stats.js")
    registry.resetToolStats()
    registry.registerDomain(makeFakeDomain())
    await registry.callTool("alpha", {})

    const result = await executeToolStats({ reset: true })
    assert.equal(result.isError, false)
    const parsed = JSON.parse(result.content[0].text)
    assert.equal(parsed.totalCalls, 0)
    assert.deepEqual(parsed.tools, [])
  })
})
