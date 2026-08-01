import { describe, it, mock, before, after } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

describe("frontendScanner", () => {
  let tmpDir: string

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "frontend-test-"))
    mkdirSync(join(tmpDir, "resources", "views", "admin"), { recursive: true })
    mkdirSync(join(tmpDir, "resources", "js"), { recursive: true })
    mkdirSync(join(tmpDir, "resources", "css"), { recursive: true })
    writeFileSync(join(tmpDir, "resources", "views", "index.blade.php"), "")
    writeFileSync(join(tmpDir, "resources", "views", "show.blade.php"), "")
    writeFileSync(join(tmpDir, "resources", "views", "admin", "dashboard.blade.php"), "")
    writeFileSync(join(tmpDir, "resources", "js", "app.js"), "")
    writeFileSync(join(tmpDir, "resources", "css", "app.css"), "")

    mock.module("../domains/laravel/mcp.js", {
      exports: {
        getConfig: () => ({ projectPath: tmpDir, phpPath: "php" }),
        getLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
      },
    })
  })

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("scans resources directory tree", async () => {
    const { executeFrontendScanner } = await import("../domains/laravel/tools/frontend-scanner.js")
    const result = executeFrontendScanner()
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("Views"))
    assert.ok(result.content[0].text.includes("JS"))
    assert.ok(result.content[0].text.includes("CSS"))
  })

  it("includes view files in output", async () => {
    const { executeFrontendScanner } = await import("../domains/laravel/tools/frontend-scanner.js")
    const result = executeFrontendScanner()
    assert.ok(result.content[0].text.includes("index.blade.php"))
    assert.ok(result.content[0].text.includes("show.blade.php"))
  })

  it("handles nested directories", async () => {
    const { executeFrontendScanner } = await import("../domains/laravel/tools/frontend-scanner.js")
    const result = executeFrontendScanner()
    assert.ok(result.content[0].text.includes("admin/"))
    assert.ok(result.content[0].text.includes("dashboard.blade.php"))
  })

  it("shows empty message for missing sections", async () => {
    rmSync(join(tmpDir, "resources", "js"), { recursive: true, force: true })
    rmSync(join(tmpDir, "resources", "css"), { recursive: true, force: true })
    const { executeFrontendScanner } = await import("../domains/laravel/tools/frontend-scanner.js")
    const result = executeFrontendScanner()
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("(empty or not found)"))
  })

  it("returns error when resources/ directory is missing", async () => {
    rmSync(join(tmpDir, "resources"), { recursive: true, force: true })
    const { executeFrontendScanner } = await import("../domains/laravel/tools/frontend-scanner.js")
    const result = executeFrontendScanner()
    assert.ok(result.isError)
    assert.ok(result.content[0].text.includes("not found"))
  })
})
