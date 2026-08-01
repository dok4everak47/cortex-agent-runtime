import { describe, it } from "node:test"
import assert from "node:assert"
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync, readdirSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { formatRunId, RunStateStore, rollbackRun } from "../domains/laravel/workflows/run-state.js"
import { runPlan } from "../domains/laravel/workflows/run-plan.js"

function makeProject(): string {
  const p = mkdtempSync(join(tmpdir(), "runstate-"))
  mkdirSync(join(p, "app"), { recursive: true })
  return p
}

describe("formatRunId", () => {
  it("produces YYYYMMDD-HHMMSS-workflow-entity", () => {
    const d = new Date(2026, 6, 31, 10, 0, 0).getTime()
    assert.equal(formatRunId(d, "createFeature", "Comment"), "20260731-100000-createfeature-comment")
  })

  it("drops empty entity", () => {
    const d = new Date(2026, 6, 31, 10, 0, 0).getTime()
    assert.equal(formatRunId(d, "debugWorkflow", ""), "20260731-100000-debugworkflow")
  })
})

describe("RunStateStore", () => {
  it("creates, updates and persists records", () => {
    const p = makeProject()
    try {
      const store = new RunStateStore(p)
      const run = store.create("createFeature", "Comment", { entity: "Comment" })
      assert.equal(run.status, "running")
      assert.equal(run.workflow, "createFeature")
      assert.ok(run.id.startsWith("20"))

      store.updateStep(run, 1, "running")
      store.updateStep(run, 1, "success", "app/Models/Comment.php")
      store.updateStep(run, 2, "failed", "boom")

      const loaded = store.get(run.id)
      assert.ok(loaded)
      assert.equal(loaded.steps.length, 2)
      assert.equal(loaded.steps[0].status, "success")
      assert.equal(loaded.steps[0].detail, "app/Models/Comment.php")
      assert.equal(loaded.steps[1].status, "failed")
      assert.ok(loaded.updatedAt >= loaded.startedAt)
    } finally {
      rmSync(p, { recursive: true, force: true })
    }
  })

  it("updates existing step instead of appending", () => {
    const p = makeProject()
    try {
      const store = new RunStateStore(p)
      const run = store.create("crudGenerator", "Tag")
      store.updateStep(run, 1, "running")
      store.updateStep(run, 1, "success", "x")
      assert.equal(run.steps.length, 1)
    } finally {
      rmSync(p, { recursive: true, force: true })
    }
  })

  it("marks success and failed", () => {
    const p = makeProject()
    try {
      const store = new RunStateStore(p)
      const run = store.create("apiGenerator", "Post")
      store.markSuccess(run)
      assert.equal(store.get(run.id)!.status, "success")
      store.markFailed(run)
      assert.equal(store.get(run.id)!.status, "failed")
    } finally {
      rmSync(p, { recursive: true, force: true })
    }
  })

  it("lists most recent first", () => {
    const p = makeProject()
    try {
      const store = new RunStateStore(p)
      const a = store.create("createFeature", "A")
      a.startedAt -= 5000
      a.updatedAt -= 5000
      store.save(a)
      const b = store.create("createFeature", "B")
      const list = store.list()
      assert.ok(list.length >= 2)
      assert.equal(list[0].id, b.id)
      assert.equal(list[1].id, a.id)
    } finally {
      rmSync(p, { recursive: true, force: true })
    }
  })

  it("findLast filters by workflow, entity and status", () => {
    const p = makeProject()
    try {
      const store = new RunStateStore(p)
      const a = store.create("createFeature", "Comment")
      store.markFailed(a)
      a.startedAt -= 5000
      store.save(a)
      const b = store.create("createFeature", "Comment")
      const found = store.findLast("createFeature", "Comment")
      assert.equal(found?.id, b.id)
      const failed = store.findLast("createFeature", "Comment", "failed")
      assert.equal(failed?.id, a.id)
      assert.equal(store.findLast("apiGenerator", "Comment"), null)
    } finally {
      rmSync(p, { recursive: true, force: true })
    }
  })

  it("assigns unique ids when two runs collide in the same second", () => {
    const p = makeProject()
    try {
      const store = new RunStateStore(p)
      const a = store.create("createFeature", "Comment")
      const b = store.create("createFeature", "Comment")
      assert.notEqual(a.id, b.id)
      assert.ok(b.id.startsWith(a.id))
      assert.equal(store.list().length, 2)
    } finally {
      rmSync(p, { recursive: true, force: true })
    }
  })

  it("get returns null for unknown run", () => {
    const p = makeProject()
    try {
      assert.equal(new RunStateStore(p).get("nope"), null)
    } finally {
      rmSync(p, { recursive: true, force: true })
    }
  })
})

describe("rollbackRun", () => {
  it("deletes artifacts in reverse order and marks rolled_back", () => {
    const p = makeProject()
    try {
      const store = new RunStateStore(p)
      const fileA = "app/Models/Comment.php"
      const fileB = "database/migrations/2026_01_01_x.php"
      mkdirSync(join(p, "app", "Models"), { recursive: true })
      mkdirSync(join(p, "database", "migrations"), { recursive: true })
      for (const f of [fileA, fileB]) writeFileSync(join(p, f), "<?php")
      const run = store.create("createFeature", "Comment")
      run.artifacts.push(fileA, fileB)
      store.save(run)

      rollbackRun(p, run.id)

      assert.ok(!existsSync(join(p, fileA)))
      assert.ok(!existsSync(join(p, fileB)))
      assert.ok(!existsSync(join(p, "app", "Models")))
      assert.equal(store.get(run.id)!.status, "rolled_back")
    } finally {
      rmSync(p, { recursive: true, force: true })
    }
  })

  it("throws for unknown run", () => {
    const p = makeProject()
    try {
      assert.throws(() => rollbackRun(p, "nope"), /not found/)
    } finally {
      rmSync(p, { recursive: true, force: true })
    }
  })
})

describe("runPlan state tracking", () => {
  const registry = {
    migration: { execute: async () => ({ status: "done", file: "database/migrations/2026_01_01_x.php" }) },
    model: { execute: async () => { throw new Error("boom") } },
    route: { execute: async () => ({ status: "done", file: "routes/web.php" }) },
    test: { execute: async () => ({ status: "done", file: "tests/Feature/XTest.php", testOutput: "OK (3 tests)" }) },
  }

  const plan = [
    { step: 1, type: "migration", params: {} },
    { step: 2, type: "model", params: {} },
    { step: 3, type: "route", params: {} },
    { step: 4, type: "test", params: {} },
  ]

  it("marks failed run and skipped follow-up steps", async () => {
    const p = makeProject()
    try {
      const { runId, runStatus } = await runPlan(plan, registry, p, { workflow: "createFeature", entity: "X" })
      assert.equal(runStatus, "failed")

      const store = new RunStateStore(p)
      const run = store.get(runId)!
      assert.equal(run.steps.length, 4)
      assert.deepEqual(run.steps.map(s => [s.step, s.status]), [
        [1, "success"], [2, "failed"], [3, "skipped"], [4, "skipped"],
      ])
      assert.deepEqual(run.artifacts, ["database/migrations/2026_01_01_x.php"])
      assert.ok(readdirSync(join(p, ".mcp", "runs")).includes(`${runId}.json`))
    } finally {
      rmSync(p, { recursive: true, force: true })
    }
  })

  it("resumes from a failed run, skipping already successful steps", async () => {
    const p = makeProject()
    try {
      const first = await runPlan(plan, registry, p, { workflow: "createFeature", entity: "X" })
      assert.equal(first.runStatus, "failed")

      const fixed = {
        ...registry,
        model: { execute: async () => ({ status: "done", file: "app/Models/X.php" }) },
      }
      const resumed = await runPlan(plan, fixed, p, { workflow: "createFeature", entity: "X", resumeFrom: first.runId })

      assert.equal(resumed.runId, first.runId)
      assert.equal(resumed.runStatus, "success")
      const resumedSteps = resumed.steps as { step: number; status: string; resumed?: boolean }[]
      assert.equal(resumedSteps[0].status, "success")
      assert.equal(resumedSteps[0].resumed, true)

      const store = new RunStateStore(p)
      const run = store.get(first.runId)!
      assert.ok(run.steps.every(s => s.status === "success"))
      assert.deepEqual(run.artifacts.sort(), [
        "app/Models/X.php",
        "database/migrations/2026_01_01_x.php",
        "routes/web.php",
        "tests/Feature/XTest.php",
      ])
      assert.equal(resumed.testOutput, "OK (3 tests)")
    } finally {
      rmSync(p, { recursive: true, force: true })
    }
  })

  it("throws when resumeFrom points to an unknown run", async () => {
    const p = makeProject()
    try {
      await assert.rejects(() => runPlan(plan, registry, p, { resumeFrom: "nope" }), /not found/)
    } finally {
      rmSync(p, { recursive: true, force: true })
    }
  })

  it("returns failed result without breaking when stopOnFailure=false (debug-style)", async () => {
    const p = makeProject()
    try {
      const failing = { execute: async () => ({ status: "failed", error: "nope" }) }
      const plan2 = [
        { step: 1, type: "a", params: {} },
        { step: 2, type: "b", params: {} },
      ]
      const registry2 = { a: failing, b: { execute: async () => ({ status: "done" }) } }
      const { runStatus, steps } = await runPlan(plan2, registry2, p, {
        workflow: "debugWorkflow", entity: "e", stopOnFailure: false, trackArtifacts: false,
      })
      assert.equal(runStatus, "failed")
      assert.equal(steps.length, 2)
    } finally {
      rmSync(p, { recursive: true, force: true })
    }
  })

  it("merges context into later steps (debug pipeline)", async () => {
    const p = makeProject()
    try {
      const locate = { execute: async () => ({ status: "done", file: "app/X.php", line: 5 }) }
      const useLocate = {
        execute: async (params: Record<string, unknown>) => {
          const prev = params.locate as { file?: string }
          return { status: "done", got: prev?.file }
        },
      }
      const plan2 = [
        { step: 1, type: "locate", params: {} },
        { step: 2, type: "use", params: {} },
      ]
      const registry2 = { locate, use: useLocate }
      const { context } = await runPlan(plan2, registry2, p, {
        workflow: "debugWorkflow", entity: "e", mergeContext: true, stopOnFailure: false, trackArtifacts: false,
      })
      const use = context!.use as { got?: string }
      assert.equal(use.got, "app/X.php")
    } finally {
      rmSync(p, { recursive: true, force: true })
    }
  })
})
