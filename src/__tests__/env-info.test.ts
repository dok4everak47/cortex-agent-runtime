import { describe, it, mock, before } from "node:test"
import assert from "node:assert"

describe("envInfo", () => {
  before(() => {
    mock.module("../domains/laravel/mcp.js", {
      exports: {
        runArtisan: () => "local",
        runTinker: (script: string) => {
          if (script.includes("app.debug")) return "true"
          if (script.includes("getPdo")) return "OK"
          return "mock"
        },
        getLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
      },
    })
  })

  it("combines multiple tinker calls into output", async () => {
    const { executeEnvInfo } = await import("../domains/laravel/tools/env-info.js")
    const result = executeEnvInfo()
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("Environment: local"))
    assert.ok(result.content[0].text.includes("Debug: true"))
    assert.ok(result.content[0].text.includes("Database: OK"))
  })
})
