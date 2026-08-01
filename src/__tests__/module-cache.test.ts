import { describe, it, mock, before, after } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

before(() => {
  mock.module("../domains/laravel/mcp.js", {
    exports: {
      getLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
    },
  })
})

describe("ModuleCache", () => {
  let tmpDir: string

  after(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true })
  })

  it("get returns null when no cache file exists", async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "module-cache-"))
    const { ModuleCache } = await import("../domains/laravel/context/module-cache.js")
    assert.equal(new ModuleCache(tmpDir).get("models"), null)
  })

  it("roundtrips set then get", async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "module-cache-"))
    const { ModuleCache } = await import("../domains/laravel/context/module-cache.js")
    const cache = new ModuleCache(tmpDir)
    cache.set("models", ["App\\Models\\Post"], {})
    const entry = cache.get<unknown>("models")
    assert.ok(entry)
    assert.deepEqual(entry.data, ["App\\Models\\Post"])
    assert.ok(typeof entry.builtAt === "number")
    assert.deepEqual(entry.dependencies, {})
  })

  it("returns null for a corrupt cache file", async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "module-cache-"))
    const { ModuleCache } = await import("../domains/laravel/context/module-cache.js")
    mkdirSync(join(tmpDir, ".mcp", "context"), { recursive: true })
    writeFileSync(join(tmpDir, ".mcp", "context", "routes.json"), "not-json", "utf-8")
    assert.equal(new ModuleCache(tmpDir).get("routes"), null)
  })

  it("isFresh compares dependency mtimes", async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "module-cache-"))
    const { ModuleCache } = await import("../domains/laravel/context/module-cache.js")
    const cache = new ModuleCache(tmpDir)
    const entry = { data: "x", builtAt: Date.now(), dependencies: { "/a.php": 100 } }
    assert.equal(cache.isFresh(entry, { "/a.php": 100 }), true)
    assert.equal(cache.isFresh(entry, { "/a.php": 101 }), false)
    assert.equal(cache.isFresh(entry, {}), false)
    assert.equal(cache.isFresh(entry, { "/a.php": 100, "/b.php": 1 }), false)
  })

  it("collectDeps records mtimes of matching files", async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "module-cache-"))
    const { ModuleCache } = await import("../domains/laravel/context/module-cache.js")
    mkdirSync(join(tmpDir, "routes"), { recursive: true })
    writeFileSync(join(tmpDir, "routes", "web.php"), "<?php")
    const cache = new ModuleCache(tmpDir)
    const deps = cache.collectDeps(["routes/*.php"])
    const keys = Object.keys(deps)
    assert.equal(keys.length, 1)
    assert.ok(keys[0].endsWith("routes/web.php"))
    assert.equal(typeof deps[keys[0]], "number")
  })

  it("collectDeps handles recursive ** glob and literal files", async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "module-cache-"))
    const { ModuleCache } = await import("../domains/laravel/context/module-cache.js")
    mkdirSync(join(tmpDir, "app", "Models", "Admin"), { recursive: true })
    writeFileSync(join(tmpDir, "app", "Models", "User.php"), "<?php")
    writeFileSync(join(tmpDir, "app", "Models", "Admin", "Role.php"), "<?php")
    writeFileSync(join(tmpDir, "composer.json"), "{}")
    const cache = new ModuleCache(tmpDir)
    const deps = cache.collectDeps(["app/Models/**/*.php", "composer.json"])
    assert.equal(Object.keys(deps).length, 3)
  })

  it("invalidate removes a single module file", async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "module-cache-"))
    const { ModuleCache } = await import("../domains/laravel/context/module-cache.js")
    const cache = new ModuleCache(tmpDir)
    cache.set("routes", [], {})
    cache.set("models", [], {})
    cache.invalidate("routes")
    assert.equal(cache.get("routes"), null)
    assert.ok(cache.get("models") !== null)
  })

  it("clearModuleCacheDir removes the whole directory", async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "module-cache-"))
    const { ModuleCache, clearModuleCacheDir } = await import("../domains/laravel/context/module-cache.js")
    new ModuleCache(tmpDir).set("models", [], {})
    assert.ok(existsSync(join(tmpDir, ".mcp", "context")))
    clearModuleCacheDir(tmpDir)
    assert.equal(existsSync(join(tmpDir, ".mcp", "context")), false)
  })

  it("clearLegacyCache removes the old context.json", async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "module-cache-"))
    const { clearLegacyCache } = await import("../domains/laravel/context/module-cache.js")
    mkdirSync(join(tmpDir, ".mcp"), { recursive: true })
    writeFileSync(join(tmpDir, ".mcp", "context.json"), "{}")
    clearLegacyCache(tmpDir)
    assert.equal(existsSync(join(tmpDir, ".mcp", "context.json")), false)
  })
})
