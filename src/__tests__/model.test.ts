import { describe, it, mock, before } from "node:test"
import assert from "node:assert"

describe("model", () => {
  before(() => {
    mock.module("../mcp.js", {
      exports: {
        runTinker: () => "App\\Models\\User\nApp\\Models\\Post\nApp\\Models\\Category",
        getLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
      },
    })
  })

  it("parses tinker output into model list", async () => {
    const { executeModel } = await import("../tools/model.js")
    const result = executeModel()
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("User"))
    assert.ok(result.content[0].text.includes("Post"))
    assert.ok(result.content[0].text.includes("Category"))
  })
})
