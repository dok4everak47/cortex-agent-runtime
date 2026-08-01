import { describe, it, mock, before } from "node:test"
import assert from "node:assert"

describe("migrateStatus", () => {
  let mockFn: (cmd: string) => string

  before(() => {
    mockFn = () => "Migration status:\n 2014_10_12_000000_create_users_table ........................... Ran"
    mock.module("../domains/laravel/mcp.js", {
      exports: {
        runArtisan: (cmd: string) => mockFn(cmd),
        getLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
      },
    })
  })

  it("returns migration status output", async () => {
    const { executeMigrateStatus } = await import("../domains/laravel/tools/migrate-status.js")
    const result = executeMigrateStatus()
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("Migration status"))
  })

  it("calls artisan with migrate:status", async () => {
    mockFn = (cmd: string) => cmd
    const { executeMigrateStatus } = await import("../domains/laravel/tools/migrate-status.js")
    const result = executeMigrateStatus()
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("migrate:status"))
  })
})
