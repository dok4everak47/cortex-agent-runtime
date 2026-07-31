import { describe, it, after } from "node:test"
import assert from "node:assert"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { readCache, writeCache, isExpired } from "../context/cache.js"

const BASE = {
  laravel: { version: "v", phpVersion: "p", environment: "local", debug: false, database: { driver: "", name: "" }, framework: "Laravel" },
  app: { name: "App", url: "" },
  models: [],
  tables: [],
  routes: { count: 0, named: [], groups: [] },
  packages: { production: [], dev: [] },
  frontend: [],
  structure: { controllers: 0, views: 0, migrations: 0, tests: 0 },
}

describe("context cache", () => {
  let tmpDir: string

  after(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true })
  })

  it("returns null when no cache file exists", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "ctx-cache-"))
    assert.equal(readCache(tmpDir), null)
  })

  it("roundtrips write then read", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "ctx-cache-"))
    const ctx = { ...BASE, builtAt: Date.now(), source: "realtime" }
    writeCache(tmpDir, ctx)
    assert.deepEqual(readCache(tmpDir), ctx)
  })

  it("returns null for corrupt cache file", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "ctx-cache-"))
    mkdirSync(join(tmpDir, ".mcp"), { recursive: true })
    writeFileSync(join(tmpDir, ".mcp", "context.json"), "not-json", "utf-8")
    assert.equal(readCache(tmpDir), null)
  })

  it("returns null for cache without builtAt", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "ctx-cache-"))
    const { builtAt: _builtAt, ...rest } = BASE
    void _builtAt
    writeCache(tmpDir, rest as never)
    assert.equal(readCache(tmpDir), null)
  })

  it("isExpired honors the TTL", () => {
    assert.equal(isExpired({ ...BASE, builtAt: Date.now(), source: "realtime" }), false)
    assert.equal(isExpired({ ...BASE, builtAt: Date.now() - 10 * 60 * 1000, source: "realtime" }), true)
  })
})
