import { describe, it, mock, before } from "node:test"
import assert from "node:assert"

describe("makeMigration", () => {
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

  it("creates migration with just name", async () => {
    const { executeMakeMigration } = await import("../tools/make-migration.js")
    const result = executeMakeMigration({ name: "create_posts_table" })
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("make:migration create_posts_table"))
  })

  it("adds --create flag", async () => {
    const { executeMakeMigration } = await import("../tools/make-migration.js")
    const result = executeMakeMigration({ name: "create_posts_table", create: true })
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("--create"))
  })

  it("adds --table flag", async () => {
    const { executeMakeMigration } = await import("../tools/make-migration.js")
    const result = executeMakeMigration({ name: "add_status_to_posts", table: "posts" })
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("--table=posts"))
  })

  it("combines --create and --table flags", async () => {
    const { executeMakeMigration } = await import("../tools/make-migration.js")
    const result = executeMakeMigration({ name: "create_posts_table", table: "posts", create: true })
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("--create"))
    assert.ok(result.content[0].text.includes("--table=posts"))
  })

  it("returns error for missing name", async () => {
    const { executeMakeMigration } = await import("../tools/make-migration.js")
    const result = executeMakeMigration({})
    assert.ok(result.isError)
    assert.ok(result.content[0].text.includes("name"))
  })

  it("falls back for empty output", async () => {
    mockOutput = ""
    const { executeMakeMigration } = await import("../tools/make-migration.js")
    const result = executeMakeMigration({ name: "create_posts_table" })
    assert.equal(result.isError, false)
    assert.equal(result.content[0].text, "Migration created successfully.")
  })
})
