import { describe, it, mock, before } from "node:test"
import assert from "node:assert"

describe("log", () => {
  let mockRun: (cmd: string) => string

  before(() => {
    mockRun = () => "[2024-01-01] log entry\n[2024-01-02] another entry"
    mock.module("../mcp.js", {
      exports: {
        runCommand: (cmd: string) => mockRun(cmd),
        getLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
      },
    })
  })

  it("uses default of 100 lines when no lines argument", async () => {
    const { executeLog } = await import("../tools/log.js")
    const result = executeLog({})
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("log entry"))
  })

  it("passes custom lines count to tail command", async () => {
    mockRun = (cmd: string) => cmd
    const { executeLog } = await import("../tools/log.js")
    const result = executeLog({ lines: 50 })
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("tail -n 50"))
  })

  it("falls back for empty log file", async () => {
    mockRun = () => ""
    const { executeLog } = await import("../tools/log.js")
    const result = executeLog({})
    assert.equal(result.isError, false)
    assert.equal(result.content[0].text, "(log file is empty)")
  })
})
