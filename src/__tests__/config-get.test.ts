import { describe, it, mock, before } from "node:test"
import assert from "node:assert"

describe("configGet", () => {
  let mockRun: (cmd: string) => string

  before(() => {
    mockRun = (cmd: string) => {
      if (cmd.includes("app.name")) return "Laravel"
      return ""
    }
    mock.module("../domains/laravel/mcp.js", {
      exports: {
        runArtisan: (cmd: string) => mockRun(cmd),
        getLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
      },
    })
  })

  it("returns config value for valid key", async () => {
    const { executeConfigGet } = await import("../domains/laravel/tools/config-get.js")
    const result = executeConfigGet({ key: "app.name" })
    assert.equal(result.isError, false)
    assert.equal(result.content[0].text, "Laravel")
  })

  it("falls back for empty value", async () => {
    const { executeConfigGet } = await import("../domains/laravel/tools/config-get.js")
    const result = executeConfigGet({ key: "mail.default" })
    assert.equal(result.isError, false)
    assert.equal(result.content[0].text, "(empty)")
  })

  it("returns error for missing key", async () => {
    const { executeConfigGet } = await import("../domains/laravel/tools/config-get.js")
    const result = executeConfigGet({})
    assert.ok(result.isError)
    assert.ok(result.content[0].text.includes("key"))
  })

  it("passes the key argument to artisan command", async () => {
    mockRun = (cmd: string) => cmd
    const { executeConfigGet } = await import("../domains/laravel/tools/config-get.js")
    const result = executeConfigGet({ key: "app.timezone" })
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("config:get app.timezone"))
  })
})
