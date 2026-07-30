import { describe, it, mock, before } from "node:test"
import assert from "node:assert"

describe("cache", () => {
  let mockOutput: string

  before(() => {
    mockOutput = "completed"
    mock.module("../mcp.js", {
      exports: {
        runArtisan: (cmd: string) => mockOutput === "passthru" ? cmd : mockOutput,
        getLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
      },
    })
  })

  it("maps clear action to cache:clear", async () => {
    mockOutput = "passthru"
    const { executeCache } = await import("../tools/cache.js")
    const result = executeCache({ action: "clear" })
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("cache:clear"))
  })

  it("maps configCache action to config:cache", async () => {
    const { executeCache } = await import("../tools/cache.js")
    const result = executeCache({ action: "configCache" })
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("config:cache"))
  })

  it("maps routeClear action to route:clear", async () => {
    const { executeCache } = await import("../tools/cache.js")
    const result = executeCache({ action: "routeClear" })
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("route:clear"))
  })

  it("maps viewClear action to view:clear", async () => {
    const { executeCache } = await import("../tools/cache.js")
    const result = executeCache({ action: "viewClear" })
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("view:clear"))
  })

  it("maps configClear action to config:clear", async () => {
    const { executeCache } = await import("../tools/cache.js")
    const result = executeCache({ action: "configClear" })
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("config:clear"))
  })

  it("maps routeCache action to route:cache", async () => {
    const { executeCache } = await import("../tools/cache.js")
    const result = executeCache({ action: "routeCache" })
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("route:cache"))
  })

  it("returns error for unknown action", async () => {
    const { executeCache } = await import("../tools/cache.js")
    const result = executeCache({ action: "unknown" })
    assert.ok(result.isError)
    assert.ok(result.content[0].text.includes("unknown action"))
  })

  it("falls back to status message when output is empty", async () => {
    mockOutput = ""
    const { executeCache } = await import("../tools/cache.js")
    const result = executeCache({ action: "clear" })
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("executed successfully"))
  })
})
