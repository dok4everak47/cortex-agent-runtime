import { describe, it, mock, before } from "node:test"
import assert from "node:assert"

describe("schema", () => {
  before(() => {
    mock.module("../mcp.js", {
      exports: {
        runTinker: () => "users\nposts\ncomments",
        getLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
      },
    })
  })

  it("parses tables output", async () => {
    const { executeSchema } = await import("../tools/schema.js")
    const result = executeSchema({ action: "tables" })
    assert.equal(result.content[0].text, "users\nposts\ncomments")
    assert.equal(result.isError, false)
  })

  it("handles columns action", async () => {
    const { executeSchema } = await import("../tools/schema.js")
    const result = executeSchema({ action: "columns", table: "users" })
    assert.equal(result.isError, false)
  })

  it("returns error for missing table in columns action", async () => {
    const { executeSchema } = await import("../tools/schema.js")
    const result = executeSchema({ action: "columns" })
    assert.ok(result.isError)
    assert.ok(result.content[0].text.includes("table"))
  })

  it("returns error for unknown action", async () => {
    const { executeSchema } = await import("../tools/schema.js")
    const result = executeSchema({ action: "invalid" })
    assert.ok(result.isError)
  })
})
