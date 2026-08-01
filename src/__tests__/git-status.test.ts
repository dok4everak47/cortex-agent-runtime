import { describe, it, mock, before } from "node:test"
import assert from "node:assert"

describe("gitStatus", () => {
  before(() => {
    mock.module("../core/mcp.js", {
      exports: {
        getConfig: () => ({ projectPath: "/tmp/fake-project" }),
        getLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
      },
    })
    mock.module("child_process", {
      exports: {
        execSync: () => "## main\n M src/index.ts",
      },
    })
  })

  it("returns git status summary", async () => {
    const { executeGitStatus } = await import("../domains/generic/tools/git-status.js")
    const result = executeGitStatus()
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("## main"))
    assert.ok(result.content[0].text.includes("src/index.ts"))
  })
})
