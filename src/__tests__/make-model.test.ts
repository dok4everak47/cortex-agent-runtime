import { describe, it, mock, before } from "node:test"
import assert from "node:assert"

describe("makeModel", () => {
  let mockFn: (cmd: string) => string

  before(() => {
    mockFn = (cmd: string) => cmd
    mock.module("../domains/laravel/mcp.js", {
      exports: {
        runArtisan: (cmd: string) => mockFn(cmd),
        getLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
      },
    })
  })

  it("creates model without flags when no options given", async () => {
    const { executeMakeModel } = await import("../domains/laravel/tools/make-model.js")
    const result = executeMakeModel({ name: "Post" })
    assert.equal(result.isError, false)
    assert.equal(result.content[0].text, "make:model Post")
  })

  it("passes -m flag for migration", async () => {
    const { executeMakeModel } = await import("../domains/laravel/tools/make-model.js")
    const result = executeMakeModel({ name: "Post", migration: true })
    assert.equal(result.isError, false)
    assert.equal(result.content[0].text, "make:model Post -m")
  })

  it("passes -f flag for factory", async () => {
    const { executeMakeModel } = await import("../domains/laravel/tools/make-model.js")
    const result = executeMakeModel({ name: "Post", factory: true })
    assert.equal(result.isError, false)
    assert.equal(result.content[0].text, "make:model Post -f")
  })

  it("passes -s flag for seed", async () => {
    const { executeMakeModel } = await import("../domains/laravel/tools/make-model.js")
    const result = executeMakeModel({ name: "Post", seed: true })
    assert.equal(result.isError, false)
    assert.equal(result.content[0].text, "make:model Post -s")
  })

  it("combines multiple flags", async () => {
    const { executeMakeModel } = await import("../domains/laravel/tools/make-model.js")
    const result = executeMakeModel({ name: "Post", migration: true, factory: true, seed: true })
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("-m"))
    assert.ok(result.content[0].text.includes("-f"))
    assert.ok(result.content[0].text.includes("-s"))
  })

  it("returns error for missing name", async () => {
    const { executeMakeModel } = await import("../domains/laravel/tools/make-model.js")
    const result = executeMakeModel({})
    assert.ok(result.isError)
    assert.ok(result.content[0].text.includes("name"))
  })

  it("falls back for empty output", async () => {
    mockFn = () => ""
    const { executeMakeModel } = await import("../domains/laravel/tools/make-model.js")
    const result = executeMakeModel({ name: "Post" })
    assert.equal(result.isError, false)
    assert.equal(result.content[0].text, "Model created successfully.")
  })
})
