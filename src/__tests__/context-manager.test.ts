import { describe, it, mock, before, after } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

const FIXTURE = {
  laravel: { version: "v", phpVersion: "p", environment: "local", debug: false, database: { driver: "", name: "" }, framework: "Laravel" },
  app: { name: "App", url: "" },
  models: [],
  tables: [],
  routes: { count: 0, named: [], groups: [] },
  packages: { production: [], dev: [] },
  frontend: [],
  structure: { controllers: 0, views: 0, migrations: 0, tests: 0 },
  source: "realtime",
}

describe("ContextManager", () => {
  let tmpDir: string
  let buildCalls = 0

  before(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "ctx-manager-"))

    mock.module("../context/builder.js", {
      exports: {
        getContext: async () => {
          buildCalls++
          return { ...FIXTURE, builtAt: Date.now() }
        },
      },
    })
  })

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("delegates to the module-based getContext", async () => {
    const { ContextManager } = await import("../context/context-manager.js")
    const ctx = await new ContextManager().getContext(tmpDir)
    assert.equal(ctx.source, "realtime")
    assert.equal(buildCalls, 1)
  })

  it("force rebuild clears the module cache directory before building", async () => {
    const { ContextManager } = await import("../context/context-manager.js")
    mkdirSync(join(tmpDir, ".mcp", "context"), { recursive: true })
    writeFileSync(join(tmpDir, ".mcp", "context", "models.json"), "{}")
    assert.ok(existsSync(join(tmpDir, ".mcp", "context", "models.json")))

    await new ContextManager().getContext(tmpDir, true)
    assert.equal(existsSync(join(tmpDir, ".mcp", "context", "models.json")), false)
    assert.equal(buildCalls, 2)
  })

  it("invalidate clears the whole module cache directory", async () => {
    const { ContextManager } = await import("../context/context-manager.js")
    mkdirSync(join(tmpDir, ".mcp", "context"), { recursive: true })
    writeFileSync(join(tmpDir, ".mcp", "context", "routes.json"), "{}")
    assert.ok(existsSync(join(tmpDir, ".mcp", "context", "routes.json")))

    new ContextManager().invalidate(tmpDir)
    assert.equal(existsSync(join(tmpDir, ".mcp", "context")), false)
  })
})
