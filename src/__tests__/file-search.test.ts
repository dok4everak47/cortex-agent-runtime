import { describe, it, mock, before, after } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

describe("fileSearch", () => {
  let tmpDir: string

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "file-search-"))
    mkdirSync(join(tmpDir, "src", "core"), { recursive: true })
    mkdirSync(join(tmpDir, "node_modules", "pkg"), { recursive: true })
    mkdirSync(join(tmpDir, ".git"), { recursive: true })
    writeFileSync(join(tmpDir, "src", "index.ts"), "")
    writeFileSync(join(tmpDir, "src", "core", "registry.ts"), "")
    writeFileSync(join(tmpDir, "package.json"), "{}")
    writeFileSync(join(tmpDir, "node_modules", "pkg", "index.ts"), "")
    writeFileSync(join(tmpDir, ".git", "config"), "")

    mock.module("../core/mcp.js", {
      exports: {
        getConfig: () => ({ projectPath: tmpDir }),
        getLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
      },
    })
  })

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("finds files matching a glob pattern", async () => {
    const { executeFileSearch } = await import("../domains/generic/tools/file-search.js")
    const result = executeFileSearch({ pattern: "src/**/*.ts" })
    assert.equal(result.isError, false)
    const text = result.content[0].text
    assert.ok(text.includes("src/index.ts"))
    assert.ok(text.includes("src/core/registry.ts"))
  })

  it("excludes .git, node_modules and vendor", async () => {
    const { executeFileSearch } = await import("../domains/generic/tools/file-search.js")
    const result = executeFileSearch({ pattern: "**/*.ts" })
    assert.equal(result.isError, false)
    const text = result.content[0].text
    assert.ok(text.includes("src/index.ts"))
    assert.ok(!text.includes("node_modules"))
    assert.ok(!text.includes(".git"))
  })

  it("returns an error when pattern is missing", async () => {
    const { executeFileSearch } = await import("../domains/generic/tools/file-search.js")
    const result = executeFileSearch({})
    assert.equal(result.isError, true)
    assert.ok(result.content[0].text.includes("pattern"))
  })
})
