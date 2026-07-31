import { describe, it, mock, before, after } from "node:test"
import assert from "node:assert"
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "fs"
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
        buildContext: async () => {
          buildCalls++
          return { ...FIXTURE, builtAt: Date.now() }
        },
      },
    })
  })

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("builds on first call, serves from memory cache on second", async () => {
    const { ContextManager } = await import("../context/context-manager.js")
    const cm = new ContextManager()

    const first = await cm.getContext(tmpDir)
    assert.equal(first.source, "realtime")
    assert.equal(buildCalls, 1)

    const second = await cm.getContext(tmpDir)
    assert.equal(second.source, "cache")
    assert.equal(buildCalls, 1)
  })

  it("serves from disk cache for a fresh manager instance", async () => {
    const { ContextManager } = await import("../context/context-manager.js")
    const cm = new ContextManager()

    const before = buildCalls
    const ctx = await cm.getContext(tmpDir)
    assert.equal(ctx.source, "cache")
    assert.equal(buildCalls, before)
  })

  it("rebuilds when the disk cache is expired", async () => {
    const { ContextManager } = await import("../context/context-manager.js")
    const before = buildCalls

    await new ContextManager().getContext(tmpDir)

    const file = join(tmpDir, ".mcp", "context.json")
    const cached = JSON.parse(readFileSync(file, "utf-8"))
    cached.builtAt = Date.now() - 10 * 60 * 1000
    writeFileSync(file, JSON.stringify(cached), "utf-8")

    const cm2 = new ContextManager()
    const ctx = await cm2.getContext(tmpDir)
    assert.equal(ctx.source, "realtime")
    assert.equal(buildCalls, before + 1)
  })

  it("force rebuilds even when the cache is fresh", async () => {
    const { ContextManager } = await import("../context/context-manager.js")
    const cm = new ContextManager()

    await cm.getContext(tmpDir)
    const before = buildCalls
    const ctx = await cm.getContext(tmpDir, true)
    assert.equal(ctx.source, "realtime")
    assert.equal(buildCalls, before + 1)
  })

  it("invalidate clears the memory cache", async () => {
    const { ContextManager } = await import("../context/context-manager.js")
    const cm = new ContextManager()

    await cm.getContext(tmpDir)

    const file = join(tmpDir, ".mcp", "context.json")
    const cached = JSON.parse(readFileSync(file, "utf-8"))
    cached.builtAt = Date.now() - 10 * 60 * 1000
    writeFileSync(file, JSON.stringify(cached), "utf-8")

    const before = buildCalls
    cm.invalidate(tmpDir)
    const ctx = await cm.getContext(tmpDir)
    assert.equal(ctx.source, "realtime")
    assert.equal(buildCalls, before + 1)
  })
})
