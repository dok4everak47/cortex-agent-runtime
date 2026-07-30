import { describe, it, mock, before } from "node:test"
import assert from "node:assert"

describe("makeController", () => {
  let mockOutput: string

  before(() => {
    mockOutput = "Created: {cmd}"
    mock.module("../mcp.js", {
      exports: {
        runArtisan: (cmd: string) => mockOutput.replace("{cmd}", cmd),
        getLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
      },
    })
  })

  it("creates controller with just name", async () => {
    const { executeMakeController } = await import("../tools/make-controller.js")
    const result = executeMakeController({ name: "UserController" })
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("make:controller UserController"))
  })

  it("adds --resource flag when resource is true", async () => {
    const { executeMakeController } = await import("../tools/make-controller.js")
    const result = executeMakeController({ name: "UserController", resource: true })
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("--resource"))
  })

  it("adds --api flag when api is true", async () => {
    const { executeMakeController } = await import("../tools/make-controller.js")
    const result = executeMakeController({ name: "UserController", resource: true, api: true })
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("--api"))
  })

  it("adds --model flag when model is specified", async () => {
    const { executeMakeController } = await import("../tools/make-controller.js")
    const result = executeMakeController({ name: "UserController", resource: true, model: "User" })
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("--model=User"))
  })

  it("composes resource with model and api flags", async () => {
    const { executeMakeController } = await import("../tools/make-controller.js")
    const result = executeMakeController({ name: "ApiUserController", resource: true, model: "User", api: true })
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("--model=User"))
    assert.ok(result.content[0].text.includes("--api"))
    assert.ok(!result.content[0].text.includes("--resource"))
  })

  it("returns error for missing name", async () => {
    const { executeMakeController } = await import("../tools/make-controller.js")
    const result = executeMakeController({})
    assert.ok(result.isError)
    assert.ok(result.content[0].text.includes("name"))
  })

  it("falls back for empty output", async () => {
    mockOutput = ""
    const { executeMakeController } = await import("../tools/make-controller.js")
    const result = executeMakeController({ name: "PostController" })
    assert.equal(result.isError, false)
    assert.equal(result.content[0].text, "Controller created successfully.")
  })
})
