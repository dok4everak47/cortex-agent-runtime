import { describe, it } from "node:test"
import assert from "node:assert"
import { TOOL_DEFINITIONS, toolHandlers, handleToolCall } from "../tool-registry.js"

describe("Tool definitions", () => {
  it("has all expected tools registered", () => {
    const names = TOOL_DEFINITIONS.map((t) => t.name).sort()
    const expected = [
      "artisan",
      "cache",
      "composerAnalyzer",
      "configGet",
      "crudGenerator",
      "envInfo",
      "envInfoSafe",
      "frontendScanner",
      "log",
      "migrateStatus",
      "makeController",
      "makeMigration",
      "makeModel",
      "migrationAnalyzer",
      "model",
      "projectContext",
      "routeList",
      "runTest",
      "schema",
    ].sort()

    assert.deepEqual(names, expected)
  })

  it("every tool has name, description, and inputSchema", () => {
    for (const tool of TOOL_DEFINITIONS) {
      assert.ok(typeof tool.name === "string" && tool.name.length > 0, `Missing name in tool`)
      assert.ok(typeof tool.description === "string" && tool.description.length > 0, `Missing description in tool '${tool.name}'`)
      assert.ok(tool.inputSchema && typeof tool.inputSchema === "object", `Missing inputSchema in tool '${tool.name}'`)
      assert.ok(typeof tool.inputSchema.type === "string", `inputSchema.type missing in tool '${tool.name}'`)
      assert.ok(typeof tool.inputSchema.properties === "object", `inputSchema.properties missing in tool '${tool.name}'`)
    }
  })
})

describe("tool handlers", () => {
  it("has a handler for every defined tool", () => {
    for (const tool of TOOL_DEFINITIONS) {
      assert.ok(toolHandlers[tool.name], `Missing handler for tool '${tool.name}'`)
    }
  })

  it("has no extra handlers without definitions", () => {
    const definedNames = new Set(TOOL_DEFINITIONS.map((t) => t.name))
    for (const name of Object.keys(toolHandlers)) {
      assert.ok(definedNames.has(name), `Handler '${name}' has no tool definition`)
    }
  })
})

describe("handleToolCall dispatch", () => {
  it("returns error for unknown tool", async () => {
    const result = await handleToolCall("unknownTool", {})
    assert.ok(result.isError)
    assert.ok(result.content[0].text.includes("Unknown tool"))
  })

  it("dispatches to correct handler for known tool", async () => {
    const result = await handleToolCall("artisan", { command: "" })
    assert.ok(result.content[0].text.includes("Error"))
  })
})
