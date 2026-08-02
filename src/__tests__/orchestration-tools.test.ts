import { describe, it, mock, before, after } from "node:test"
import assert from "node:assert"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { createTask, writeTask } from "../domains/orchestration/state/task-store.js"

function makeProject(): string {
  return mkdtempSync(join(tmpdir(), "orchestration-tools-"))
}

describe("orchestration tools", () => {
  let projectPath = ""

  before(() => {
    mock.module("../core/mcp.js", {
      exports: {
        getConfig: () => ({ projectPath }),
        getLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
      },
    })
  })

  after(() => {
    if (projectPath) rmSync(projectPath, { recursive: true, force: true })
  })

  // 每个用例独立临时目录, 避免相互污染
  function freshDir(): void {
    if (projectPath) rmSync(projectPath, { recursive: true, force: true })
    projectPath = makeProject()
  }

  describe("taskStatus", () => {
    it("returns a friendly message when .htask is missing", async () => {
      freshDir()
      const { executeTaskStatus } = await import("../domains/orchestration/tools/task-status.js")
      const result = await executeTaskStatus()
      assert.equal(result.isError, false)
      assert.ok(result.content[0].text.includes(".htask"))
    })

    it("returns '(no tasks)' when .htask exists but has no tasks", async () => {
      freshDir()
      mkdirSync(join(projectPath, ".htask"), { recursive: true })
      const { executeTaskStatus } = await import("../domains/orchestration/tools/task-status.js")
      const result = await executeTaskStatus()
      assert.equal(result.isError, false)
      assert.equal(result.content[0].text, "(no tasks)")
    })

    it("lists all tasks with state, next step, dwell and a status summary", async () => {
      freshDir()
      const a = await createTask(projectPath, { title: "Alpha" })
      const b = await createTask(projectPath, { title: "Beta" })
      b.status = "MERGED"
      b.endedAt = new Date().toISOString()
      b.updatedAt = new Date().toISOString()
      await writeTask(projectPath, b)

      const { executeTaskStatus } = await import("../domains/orchestration/tools/task-status.js")
      const result = await executeTaskStatus()
      assert.equal(result.isError, false)
      const text = result.content[0].text
      assert.ok(text.includes(a.id))
      assert.ok(text.includes("Alpha"))
      assert.ok(text.includes("Beta"))
      assert.ok(text.includes("CREATED"))
      assert.ok(text.includes("MERGED"))
      assert.ok(text.includes("WAITING_HUMAN"))
      assert.ok(text.includes("DONE"))
      assert.ok(text.includes("状态摘要: 共 2 个任务"))
    })

    it("marks a stale task as 卡住", async () => {
      freshDir()
      const t = await createTask(projectPath, { title: "Stale" })
      t.status = "IMPLEMENTING"
      t.updatedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      await writeTask(projectPath, t)

      const { executeTaskStatus } = await import("../domains/orchestration/tools/task-status.js")
      const result = await executeTaskStatus()
      assert.equal(result.isError, false)
      const text = result.content[0].text
      assert.ok(text.includes("卡住"))
      assert.ok(text.includes("STALE"))
    })
  })

  describe("taskMetrics", () => {
    it("returns a friendly message when .htask is missing", async () => {
      freshDir()
      const { executeTaskMetrics } = await import("../domains/orchestration/tools/task-metrics.js")
      const result = await executeTaskMetrics()
      assert.equal(result.isError, false)
      assert.ok(result.content[0].text.includes(".htask"))
    })

    it("returns '(no tasks)' when there are no task records", async () => {
      freshDir()
      mkdirSync(join(projectPath, ".htask"), { recursive: true })
      const { executeTaskMetrics } = await import("../domains/orchestration/tools/task-metrics.js")
      const result = await executeTaskMetrics()
      assert.equal(result.isError, false)
      assert.equal(result.content[0].text, "(no tasks)")
    })

    it("reports TTV table, wait ratio and bottleneck ranking for complete data", async () => {
      freshDir()
      const mk = async (title: string, created: string, verifying: string, accepted: string, merged: string, implMs: number) => {
        const t = await createTask(projectPath, { title })
        t.status = "MERGED"
        t.endedAt = merged
        t.history = [
          { from: null, to: "CREATED", at: created, by: "auto" },
          { from: "CREATED", to: "VERIFYING", at: verifying, by: "auto" },
          { from: "VERIFYING", to: "ACCEPTED", at: accepted, by: "alice" },
          { from: "ACCEPTED", to: "MERGED", at: merged, by: "auto" },
        ]
        t.implementDurationMs = implMs
        await writeTask(projectPath, t)
      }
      await mk("Alpha", "2026-01-01T00:00:00.000Z", "2026-01-01T02:00:00.000Z", "2026-01-01T03:00:00.000Z", "2026-01-01T04:00:00.000Z", 60_000)
      await mk("Beta", "2026-01-02T00:00:00.000Z", "2026-01-02T01:00:00.000Z", "2026-01-02T03:00:00.000Z", "2026-01-02T04:00:00.000Z", 120_000)

      const { executeTaskMetrics } = await import("../domains/orchestration/tools/task-metrics.js")
      const result = await executeTaskMetrics()
      assert.equal(result.isError, false)
      const text = result.content[0].text
      assert.ok(text.includes("等待占比"))
      assert.ok(text.includes("瓶颈"))
      assert.ok(text.includes("2/2 任务完整"))
    })

    it("annotates tasks with missing data using ⚠️", async () => {
      freshDir()
      const t = await createTask(projectPath, { title: "Fresh" })
      t.implementDurationMs = null
      await writeTask(projectPath, t)

      const { executeTaskMetrics } = await import("../domains/orchestration/tools/task-metrics.js")
      const result = await executeTaskMetrics()
      assert.equal(result.isError, false)
      const text = result.content[0].text
      assert.ok(text.includes("⚠️缺"))
      assert.ok(text.includes("未计入汇总"))
    })
  })

  describe("policyGet", () => {
    it("reports file source with high/low rules and the yaml path", async () => {
      freshDir()
      mkdirSync(join(projectPath, ".htask"), { recursive: true })
      writeFileSync(join(projectPath, ".htask", "approval.yaml"), "rules:\n  high_risk: true\n  low_risk: false\n")

      const { executePolicyGet } = await import("../domains/orchestration/tools/policy-get.js")
      const result = await executePolicyGet()
      assert.equal(result.isError, false)
      const text = result.content[0].text
      assert.ok(text.includes("来源: file"))
      assert.ok(text.includes("high_risk: true"))
      assert.ok(text.includes("low_risk: false"))
      assert.ok(text.includes("approval.yaml"))
    })

    it("reports default source when no approval.yaml exists", async () => {
      freshDir()
      const { executePolicyGet } = await import("../domains/orchestration/tools/policy-get.js")
      const result = await executePolicyGet()
      assert.equal(result.isError, false)
      const text = result.content[0].text
      assert.ok(text.includes("来源: default"))
      assert.ok(text.includes("high_risk: true"))
    })
  })

  describe("manifest registration", () => {
    it("orchestration domain registers the 3 read-only tools", async () => {
      const { orchestrationDomain } = await import("../domains/orchestration/manifest.js")
      const names = orchestrationDomain.getTools().map((t) => t.name)
      assert.deepEqual(names, ["taskStatus", "taskMetrics", "policyGet"])
      for (const name of names) {
        assert.ok(orchestrationDomain.getHandlers()[name], `missing handler for ${name}`)
      }
    })
  })
})
