import { describe, it, mock, before, after } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

describe("projectTree", () => {
  let tmpDir: string

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "project-tree-"))
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

  it("lists a two-level directory tree", async () => {
    const { executeProjectTree } = await import("../domains/generic/tools/project-tree.js")
    const result = executeProjectTree()
    assert.equal(result.isError, false)
    const text = result.content[0].text
    assert.ok(text.includes("src/"))
    assert.ok(text.includes("package.json"))
    assert.ok(!text.includes("node_modules"))
    assert.ok(!text.includes(".git"))
  })
})
