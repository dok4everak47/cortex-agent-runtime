import { describe, it } from "node:test"
import assert from "node:assert"
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { RunStateStore } from "../workflows/run-state.js"
import { executeWorkflowStatus } from "../tools/workflow-status.js"

function makeProject(): string {
  const p = mkdtempSync(join(tmpdir(), "wf-status-"))
  mkdirSync(join(p, "app"), { recursive: true })
  return p
}

function withProject(p: string, fn: () => Promise<void>) {
  const orig = process.env.LARAVEL_PROJECT_PATH
  process.env.LARAVEL_PROJECT_PATH = p
  return (async () => {
    try {
      await fn()
    } finally {
      if (orig) process.env.LARAVEL_PROJECT_PATH = orig
      else delete process.env.LARAVEL_PROJECT_PATH
    }
  })()
}

describe("workflowStatus", () => {
  it("lists runs", async () => {
    const p = makeProject()
    await withProject(p, async () => {
      const store = new RunStateStore(p)
      store.create("createFeature", "Comment")
      const res = await executeWorkflowStatus({ action: "list" })
      assert.ok(!res.isError)
      const parsed = JSON.parse(res.content[0].text)
      assert.equal(parsed.action, "list")
      assert.ok(Array.isArray(parsed.runs))
      assert.equal(parsed.runs.length, 1)
      assert.equal(parsed.runs[0].workflow, "createFeature")
    })
    rmSync(p, { recursive: true, force: true })
  })

  it("gets a run by id", async () => {
    const p = makeProject()
    await withProject(p, async () => {
      const store = new RunStateStore(p)
      const run = store.create("apiGenerator", "Post")
      const res = await executeWorkflowStatus({ action: "get", runId: run.id })
      const parsed = JSON.parse(res.content[0].text)
      assert.equal(parsed.run.id, run.id)
      assert.equal(parsed.run.status, "running")
    })
    rmSync(p, { recursive: true, force: true })
  })

  it("errors for unknown run id", async () => {
    const p = makeProject()
    await withProject(p, async () => {
      const res = await executeWorkflowStatus({ action: "get", runId: "nope" })
      assert.ok(res.isError)
    })
    rmSync(p, { recursive: true, force: true })
  })

  it("rolls back a run, deleting artifacts", async () => {
    const p = makeProject()
    await withProject(p, async () => {
      const store = new RunStateStore(p)
      const file = "app/Models/Comment.php"
      mkdirSync(join(p, "app", "Models"), { recursive: true })
      writeFileSync(join(p, file), "<?php")
      const run = store.create("createFeature", "Comment")
      run.artifacts.push(file)
      store.save(run)

      const res = await executeWorkflowStatus({ action: "rollback", runId: run.id })
      const parsed = JSON.parse(res.content[0].text)
      assert.equal(parsed.status, "rolled_back")
      assert.ok(!existsSync(join(p, file)))
      assert.equal(store.get(run.id)!.status, "rolled_back")
    })
    rmSync(p, { recursive: true, force: true })
  })

  it("resumes a debug run through its handler (no artisan needed)", async () => {
    const p = makeProject()
    await withProject(p, async () => {
      const store = new RunStateStore(p)
      const run = store.create("debugWorkflow", "error", { error: "Something unexpected happened" })
      store.markFailed(run)

      const res = await executeWorkflowStatus({ action: "resume", runId: run.id })
      assert.ok(!res.isError)
      const parsed = JSON.parse(res.content[0].text)
      assert.equal(parsed.runId, run.id)
      assert.equal(parsed.runStatus, "success")
      assert.ok(typeof parsed.report === "string" && parsed.report.length > 0)
      assert.equal(store.get(run.id)!.status, "success")
    })
    rmSync(p, { recursive: true, force: true })
  })

  it("rejects resuming a successful or rolled back run", async () => {
    const p = makeProject()
    await withProject(p, async () => {
      const store = new RunStateStore(p)
      const ok = store.create("debugWorkflow", "e", { error: "x" })
      store.markSuccess(ok)
      const res = await executeWorkflowStatus({ action: "resume", runId: ok.id })
      assert.ok(res.isError)
      assert.ok(res.content[0].text.includes("already completed"))

      const rb = store.create("debugWorkflow", "e", { error: "x" })
      rb.status = "rolled_back"
      store.save(rb)
      const res2 = await executeWorkflowStatus({ action: "resume", runId: rb.id })
      assert.ok(res2.isError)
    })
    rmSync(p, { recursive: true, force: true })
  })

  it("errors on unknown action", async () => {
    const p = makeProject()
    await withProject(p, async () => {
      const res = await executeWorkflowStatus({ action: "frobnicate" })
      assert.ok(res.isError)
    })
    rmSync(p, { recursive: true, force: true })
  })
})
