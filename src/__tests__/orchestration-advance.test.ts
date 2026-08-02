import { describe, it, mock, before, after } from "node:test"
import assert from "node:assert"
import { execSync } from "child_process"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { readTask, writeTask, type TaskRecord } from "../domains/orchestration/state/task-store.js"

function makeProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "orchestration-advance-"))
  execSync("git init -q", { cwd: dir })
  execSync('git config user.email "test@example.com"', { cwd: dir })
  execSync('git config user.name "Test"', { cwd: dir })
  writeFileSync(join(dir, "README.md"), "# fixture\n")
  execSync("git add -A && git commit -qm baseline", { cwd: dir })
  return dir
}

function verifyingTask(id: string, title: string, overrides: Partial<TaskRecord> = {}): TaskRecord {
  const now = new Date().toISOString()
  const base: TaskRecord = {
    id,
    title,
    status: "VERIFYING",
    agent: null,
    agentBackend: null,
    model: "deepseek/deepseek-v4-flash",
    taskFile: "TASK.md",
    plan: null,
    review: null,
    verification: null,
    history: [
      { from: null, to: "CREATED", at: now, by: "auto" },
      { from: "CREATED", to: "VERIFYING", at: now, by: "auto" },
    ],
    startedAt: now,
    updatedAt: now,
    endedAt: null,
    implementExit: 0,
    implementDurationMs: 1000,
    verify: [{ command: "npm test", exitCode: 0 }],
  }
  return { ...base, ...overrides }
}

function gitLog(cwd: string, fmt: string): string {
  return execSync(`git log -1 --format=${fmt}`, { cwd, encoding: "utf8" }).trim()
}

function events(p: string): string[] {
  try {
    return readFileSync(join(p, ".htask", "events.jsonl"), "utf8").trim().split("\n").filter(Boolean)
  } catch {
    return []
  }
}

describe("orchestration advance (taskAccept/taskAdvance/doMerge)", () => {
  let projectPath = ""
  const dirs: string[] = []

  before(() => {
    mock.module("../core/mcp.js", {
      exports: {
        getConfig: () => ({ projectPath }),
        getLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
      },
    })
  })

  after(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true })
  })

  function freshDir(): string {
    const dir = makeProject()
    dirs.push(dir)
    projectPath = dir
    return dir
  }

  describe("taskAccept", () => {
    it("accepts a VERIFYING task with all checks passing → ACCEPTED + event", async () => {
      const p = freshDir()
      await writeTask(p, verifyingTask("task-a", "Feature A"))
      const { executeTaskAccept } = await import("../domains/orchestration/tools/task-accept.js")
      const res = await executeTaskAccept({ taskId: "task-a" })
      assert.equal(res.isError, false)
      assert.ok(res.content[0].text.includes("ACCEPTED"))
      const task = await readTask(p, "task-a")
      assert.equal(task?.status, "ACCEPTED")
      assert.ok(task?.history.some((h) => h.to === "ACCEPTED" && h.by === "human"))
      const last = events(p).at(-1) ?? ""
      assert.ok(last.includes("task.waiting_human"))
      assert.ok(last.includes('reason":"merge"'))
    })

    it("rejects a VERIFYING task with failed verification", async () => {
      const p = freshDir()
      await writeTask(p, verifyingTask("task-a", "Feature A", { verify: [{ command: "npm test", exitCode: 1 }] }))
      const { executeTaskAccept } = await import("../domains/orchestration/tools/task-accept.js")
      const res = await executeTaskAccept({ taskId: "task-a" })
      assert.equal(res.isError, true)
      assert.ok(res.content[0].text.includes("验证未全过"))
      assert.equal((await readTask(p, "task-a"))?.status, "VERIFYING")
    })

    it("rejects a non-VERIFYING task", async () => {
      const p = freshDir()
      await writeTask(p, verifyingTask("task-a", "Feature A", { status: "ACCEPTED" }))
      const { executeTaskAccept } = await import("../domains/orchestration/tools/task-accept.js")
      const res = await executeTaskAccept({ taskId: "task-a" })
      assert.equal(res.isError, true)
      assert.ok(res.content[0].text.includes("只有 VERIFYING 可 accept"))
    })

    it("returns a friendly failure when the task does not exist", async () => {
      freshDir()
      const { executeTaskAccept } = await import("../domains/orchestration/tools/task-accept.js")
      const res = await executeTaskAccept({ taskId: "task-nope" })
      assert.equal(res.isError, true)
      assert.ok(res.content[0].text.includes("不存在"))
    })

    it("accepts the specified taskId even when the current task differs", async () => {
      const p = freshDir()
      await writeTask(p, verifyingTask("task-a", "Feature A"))
      await writeTask(p, verifyingTask("task-b", "Feature B"))
      const { executeTaskAccept } = await import("../domains/orchestration/tools/task-accept.js")
      const res = await executeTaskAccept({ taskId: "task-b" })
      assert.equal(res.isError, false)
      assert.equal((await readTask(p, "task-b"))?.status, "ACCEPTED")
      assert.equal((await readTask(p, "task-a"))?.status, "VERIFYING")
    })
  })

  describe("taskAdvance", () => {
    it("is idempotent for a MERGED task (no-op success)", async () => {
      const p = freshDir()
      await writeTask(p, verifyingTask("task-a", "Feature A", { status: "MERGED", endedAt: new Date().toISOString() }))
      const { executeTaskAdvance } = await import("../domains/orchestration/tools/task-advance.js")
      const res = await executeTaskAdvance({ taskId: "task-a" })
      assert.equal(res.isError, false)
      assert.ok(res.content[0].text.includes("无操作"))
      assert.equal((await readTask(p, "task-a"))?.status, "MERGED")
    })

    it("blocks a VERIFYING task whose verification did not pass", async () => {
      const p = freshDir()
      await writeTask(p, verifyingTask("task-a", "Feature A", { verify: [{ command: "npm test", exitCode: 1 }] }))
      const { executeTaskAdvance } = await import("../domains/orchestration/tools/task-advance.js")
      const res = await executeTaskAdvance({ taskId: "task-a" })
      assert.equal(res.isError, true)
      assert.ok(res.content[0].text.includes("验证未全过"))
      assert.equal((await readTask(p, "task-a"))?.status, "VERIFYING")
    })

    it("stops at WAITING_HUMAN without advancing when the approval gate needs a human", async () => {
      const p = freshDir()
      await writeTask(
        p,
        verifyingTask("task-a", "Feature A", { plan: { risk: ["database"], pipeline: ["implement"] } })
      )
      const { executeTaskAdvance } = await import("../domains/orchestration/tools/task-advance.js")
      const res = await executeTaskAdvance({ taskId: "task-a", noPush: true })
      assert.equal(res.isError, false)
      assert.ok(res.content[0].text.includes("WAITING_HUMAN"))
      assert.equal((await readTask(p, "task-a"))?.status, "VERIFYING")
    })

    it("auto-advances a VERIFYING task without a plan all the way to MERGED with a git commit", async () => {
      const p = freshDir()
      mkdirSync(join(p, "src"))
      writeFileSync(join(p, "src", "feature.ts"), "export const a = 1\n")
      await writeTask(p, verifyingTask("task-a", "Feature A"))
      const { executeTaskAdvance } = await import("../domains/orchestration/tools/task-advance.js")
      const res = await executeTaskAdvance({ taskId: "task-a", noPush: true })
      assert.equal(res.isError, false)
      assert.ok(res.content[0].text.includes("MERGED"))
      assert.equal((await readTask(p, "task-a"))?.status, "MERGED")
      assert.equal(gitLog(p, "%s"), "Feature A")
      const last = events(p).at(-1) ?? ""
      assert.ok(last.includes("task.completed"))
      assert.ok(last.includes('"status":"MERGED"'))
    })

    it("auto-advances through the gate when the policy is auto (low_risk false)", async () => {
      const p = freshDir()
      mkdirSync(join(p, ".htask"), { recursive: true })
      writeFileSync(join(p, ".htask", "approval.yaml"), "rules:\n  high_risk: true\n  low_risk: false\n")
      mkdirSync(join(p, "src"))
      writeFileSync(join(p, "src", "feature.ts"), "export const a = 1\n")
      await writeTask(p, verifyingTask("task-a", "Feature A", { plan: { risk: [], pipeline: ["implement"] } }))
      const { executeTaskAdvance } = await import("../domains/orchestration/tools/task-advance.js")
      const res = await executeTaskAdvance({ taskId: "task-a", noPush: true })
      assert.equal(res.isError, false)
      assert.equal((await readTask(p, "task-a"))?.status, "MERGED")
    })

    it("merges an ACCEPTED task: commit message = title, excludes REPORT/REVIEW/.htask", async () => {
      const p = freshDir()
      await writeTask(p, verifyingTask("task-a", "Feature A", { status: "ACCEPTED" }))
      mkdirSync(join(p, "src"))
      writeFileSync(join(p, "src", "feature.ts"), "export const a = 1\n")
      writeFileSync(join(p, "REPORT.md"), "# report\n")
      writeFileSync(join(p, "REVIEW.md"), "# review\n")
      const { executeTaskAdvance } = await import("../domains/orchestration/tools/task-advance.js")
      const res = await executeTaskAdvance({ taskId: "task-a", noPush: true })
      assert.equal(res.isError, false)
      assert.equal((await readTask(p, "task-a"))?.status, "MERGED")
      assert.equal(gitLog(p, "%s"), "Feature A")
      const names = execSync("git diff --name-only HEAD~1 HEAD", { cwd: p, encoding: "utf8" }).split("\n")
      assert.ok(names.includes("src/feature.ts"))
      assert.ok(!names.includes("REPORT.md"))
      assert.ok(!names.includes("REVIEW.md"))
      assert.ok(!names.some((n) => n.startsWith(".htask")))
    })

    it("gracefully archives a task with no code changes (nothing to commit)", async () => {
      const p = freshDir()
      await writeTask(p, verifyingTask("task-a", "Feature A", { status: "ACCEPTED" }))
      const { executeTaskAdvance } = await import("../domains/orchestration/tools/task-advance.js")
      const res = await executeTaskAdvance({ taskId: "task-a", noPush: true })
      assert.equal(res.isError, false)
      assert.ok(res.content[0].text.includes("仅归档"))
      assert.equal((await readTask(p, "task-a"))?.status, "MERGED")
    })

    it("skips push when noPush is set", async () => {
      const p = freshDir()
      await writeTask(p, verifyingTask("task-a", "Feature A", { status: "ACCEPTED" }))
      const { executeTaskAdvance } = await import("../domains/orchestration/tools/task-advance.js")
      const res = await executeTaskAdvance({ taskId: "task-a", noPush: true })
      assert.equal(res.isError, false)
      assert.ok(res.content[0].text.includes("跳过 git push"))
      assert.equal((await readTask(p, "task-a"))?.status, "MERGED")
    })

    it("warns only (does not fail) when push fails against a repo without a remote", async () => {
      const p = freshDir()
      await writeTask(p, verifyingTask("task-a", "Feature A", { status: "ACCEPTED" }))
      const { executeTaskAdvance } = await import("../domains/orchestration/tools/task-advance.js")
      const res = await executeTaskAdvance({ taskId: "task-a", noPush: false })
      assert.equal(res.isError, false)
      assert.ok(res.content[0].text.includes("push 失败"))
      assert.equal((await readTask(p, "task-a"))?.status, "MERGED")
    })

    it("skips with a friendly message for a not-yet-started CREATED task", async () => {
      const p = freshDir()
      await writeTask(p, verifyingTask("task-a", "Feature A", { status: "CREATED" }))
      const { executeTaskAdvance } = await import("../domains/orchestration/tools/task-advance.js")
      const res = await executeTaskAdvance({ taskId: "task-a", noPush: true })
      assert.equal(res.isError, false)
      assert.ok(res.content[0].text.includes("未开始"))
      assert.equal((await readTask(p, "task-a"))?.status, "CREATED")
    })
  })
})
