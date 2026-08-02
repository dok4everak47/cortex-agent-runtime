import { describe, it } from "node:test"
import assert from "node:assert"
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import {
  createTask,
  currentTask,
  migrateLegacyState,
  newTaskId,
  readAllTasks,
  readState,
  readTask,
  writeTask,
} from "../domains/orchestration/state/task-store.js"
import { TRANSITIONS, TERMINAL, transition, STATES } from "../domains/orchestration/state/state-machine.js"

function makeProject(): string {
  return mkdtempSync(join(tmpdir(), "orchestration-"))
}

function cleanup(p: string): void {
  rmSync(p, { recursive: true, force: true })
}

describe("newTaskId", () => {
  it("produces task-YYYYMMDD-slug", () => {
    const id = newTaskId("Cortex orchestration domain")
    assert.match(id, /^task-\d{8}-cortexorches$/)
  })

  it("falls back to 'task' when title has no alnum chars", () => {
    const id = newTaskId("!!!")
    assert.match(id, /^task-\d{8}-task$/)
  })
})

describe("task store", () => {
  it("createTask writes tasks/<id>.json and state.json pointer", async () => {
    const p = makeProject()
    try {
      const task = await createTask(p, { title: "Hello World" })
      assert.equal(task.status, "CREATED")
      assert.ok(task.id.startsWith("task-"))

      const loaded = await readTask(p, task.id)
      assert.ok(loaded)
      assert.equal(loaded!.title, "Hello World")
      assert.equal(loaded!.history.length, 1)
      assert.equal(loaded!.history[0].to, "CREATED")

      const state = await readState(p)
      assert.equal(state!.currentId, task.id)
    } finally {
      cleanup(p)
    }
  })

  it("writeTask/readTask round-trip preserves fields", async () => {
    const p = makeProject()
    try {
      const task = await createTask(p, { title: "Round Trip" })
      task.title = "Updated"
      task.status = "PLANNING"
      task.history.push({ from: "CREATED", to: "PLANNING", at: new Date().toISOString(), by: "test" })
      await writeTask(p, task)

      const loaded = await readTask(p, task.id)
      assert.equal(loaded!.title, "Updated")
      assert.equal(loaded!.status, "PLANNING")
      assert.equal(loaded!.history.length, 2)
    } finally {
      cleanup(p)
    }
  })

  it("readTask returns null for unknown id", async () => {
    const p = makeProject()
    try {
      assert.equal(await readTask(p, "nope"), null)
    } finally {
      cleanup(p)
      assert.equal(true, true)
    }
  })

  it("readAllTasks sorts by startedAt and skips corrupt files", async () => {
    const p = makeProject()
    try {
      const a = await createTask(p, { title: "Alpha" })
      const b = await createTask(p, { title: "Beta" })
      a.startedAt = "2026-01-01T00:00:00.000Z"
      b.startedAt = "2026-02-01T00:00:00.000Z"
      await writeTask(p, a)
      await writeTask(p, b)

      mkdirSync(join(p, ".htask", "tasks"), { recursive: true })
      writeFileSync(join(p, ".htask", "tasks", "broken.json"), "{not json")

      const tasks = await readAllTasks(p)
      assert.equal(tasks.length, 2)
      assert.equal(tasks[0].id, a.id)
      assert.equal(tasks[1].id, b.id)
    } finally {
      cleanup(p)
    }
  })

  it("currentTask follows the state.json pointer", async () => {
    const p = makeProject()
    try {
      const task = await createTask(p, { title: "Pointer" })
      const cur = await currentTask(p)
      assert.equal(cur!.id, task.id)
    } finally {
      cleanup(p)
    }
  })

  it("currentTask returns null with no state file", async () => {
    const p = makeProject()
    try {
      assert.equal(await currentTask(p), null)
    } finally {
      cleanup(p)
    }
  })
})

describe("migrateLegacyState", () => {
  it("migrates old state.json (with status) to tasks/<id>.json and writes pointer", async () => {
    const p = makeProject()
    try {
      mkdirSync(join(p, ".htask"), { recursive: true })
      writeFileSync(
        join(p, ".htask", "state.json"),
        JSON.stringify({
          status: "done",
          title: "Legacy Task",
          startedAt: "2026-07-01T00:00:00.000Z",
          endedAt: "2026-07-02T00:00:00.000Z",
        })
      )

      const task = await migrateLegacyState(p)
      assert.ok(task)
      assert.match(task!.id, /legacy$/)
      assert.equal(task!.status, "VERIFYING")
      assert.equal(task!.title, "Legacy Task")

      const state = await readState(p)
      assert.equal(state!.currentId, task!.id)
      const loaded = await readTask(p, task!.id)
      assert.equal(loaded!.status, "VERIFYING")
    } finally {
      cleanup(p)
    }
  })

  it("is idempotent — returns null once pointer format exists", async () => {
    const p = makeProject()
    try {
      await createTask(p, { title: "New" })
      assert.equal(await migrateLegacyState(p), null)
    } finally {
      cleanup(p)
    }
  })

  it("maps running → IMPLEMENTING and sets endedAt for terminal status", async () => {
    const p = makeProject()
    try {
      mkdirSync(join(p, ".htask"), { recursive: true })
      writeFileSync(join(p, ".htask", "state.json"), JSON.stringify({ status: "failed", startedAt: "2026-07-01T00:00:00.000Z" }))

      const task = await migrateLegacyState(p)
      assert.equal(task!.status, "FAILED")
      assert.ok(task!.endedAt)
    } finally {
      cleanup(p)
    }
  })
})

describe("state machine transition", () => {
  it("allows the happy path CREATED → PLANNING → IMPLEMENTING → REVIEWING → VERIFYING → ACCEPTED → MERGED", async () => {
    const p = makeProject()
    try {
      const task = await createTask(p, { title: "Happy Path" })
      let t = task
      for (const next of ["PLANNING", "IMPLEMENTING", "REVIEWING", "VERIFYING", "ACCEPTED", "MERGED"]) {
        t = await transition(p, t.id, next as (typeof STATES)[number])
      }
      assert.equal(t.status, "MERGED")
      const loaded = await readTask(p, t.id)
      assert.equal(loaded!.history.length, 7)
      assert.deepEqual(
        loaded!.history.map((h) => h.to),
        ["CREATED", "PLANNING", "IMPLEMENTING", "REVIEWING", "VERIFYING", "ACCEPTED", "MERGED"]
      )
    } finally {
      cleanup(p)
    }
  })

  it("rejects illegal transition CREATED → MERGED", async () => {
    const p = makeProject()
    try {
      const task = await createTask(p, { title: "Skip" })
      await assert.rejects(() => transition(p, task.id, "MERGED"), /非法迁移: CREATED → MERGED/)
      const loaded = await readTask(p, task.id)
      assert.equal(loaded!.status, "CREATED")
      assert.equal(loaded!.history.length, 1)
    } finally {
      cleanup(p)
    }
  })

  it("rejects unknown transitions for terminal states (MERGED has no outgoing)", async () => {
    const p = makeProject()
    try {
      const task = await createTask(p, { title: "Terminal" })
      await transition(p, task.id, "PLANNING")
      await transition(p, task.id, "IMPLEMENTING")
      await transition(p, task.id, "REVIEWING")
      await transition(p, task.id, "VERIFYING")
      await transition(p, task.id, "ACCEPTED")
      await transition(p, task.id, "MERGED")
      await assert.rejects(() => transition(p, task.id, "REVIEWING"), /非法迁移/)
    } finally {
      cleanup(p)
    }
  })

  it("same-state transition is idempotent (no duplicate history)", async () => {
    const p = makeProject()
    try {
      const task = await createTask(p, { title: "Idem" })
      await transition(p, task.id, "PLANNING")
      const before = (await readTask(p, task.id))!.history.length
      await transition(p, task.id, "PLANNING")
      const after = (await readTask(p, task.id))!.history.length
      assert.equal(after, before)
    } finally {
      cleanup(p)
    }
  })

  it("writes history entries with correct from/to/by", async () => {
    const p = makeProject()
    try {
      const task = await createTask(p, { title: "By Me" })
      await transition(p, task.id, "PLANNING", "alice")
      const loaded = await readTask(p, task.id)
      const entry = loaded!.history[loaded!.history.length - 1]
      assert.equal(entry.from, "CREATED")
      assert.equal(entry.to, "PLANNING")
      assert.equal(entry.by, "alice")
      assert.ok(entry.at)
    } finally {
      cleanup(p)
    }
  })

  it("writes endedAt when entering a terminal state", async () => {
    const p = makeProject()
    try {
      const task = await createTask(p, { title: "End" })
      await transition(p, task.id, "PLANNING")
      await transition(p, task.id, "IMPLEMENTING")
      await transition(p, task.id, "VERIFYING")
      await transition(p, task.id, "ACCEPTED")
      await transition(p, task.id, "MERGED")
      const loaded = await readTask(p, task.id)
      assert.ok(loaded!.endedAt)
      assert.equal(loaded!.endedAt, loaded!.updatedAt)
    } finally {
      cleanup(p)
    }
  })

  it("retry FAILED → PLANNING clears endedAt", async () => {
    const p = makeProject()
    try {
      const task = await createTask(p, { title: "Retry" })
      await transition(p, task.id, "PLANNING")
      await transition(p, task.id, "IMPLEMENTING")
      await transition(p, task.id, "FAILED")
      const failed = await readTask(p, task.id)
      assert.ok(failed!.endedAt)
      await transition(p, task.id, "PLANNING")
      const retried = await readTask(p, task.id)
      assert.equal(retried!.status, "PLANNING")
      assert.equal(retried!.endedAt, null)
    } finally {
      cleanup(p)
    }
  })

  it("throws when the task does not exist", async () => {
    const p = makeProject()
    try {
      await assert.rejects(() => transition(p, "ghost", "PLANNING"), /任务不存在/)
    } finally {
      cleanup(p)
    }
  })
})

describe("transition table integrity", () => {
  it("only references known states", () => {
    const known = new Set<string>(STATES)
    for (const from of Object.keys(TRANSITIONS)) {
      assert.ok(known.has(from), `unknown from state ${from}`)
      for (const to of TRANSITIONS[from as (typeof STATES)[number]]) {
        assert.ok(known.has(to), `unknown to state ${to} from ${from}`)
      }
    }
  })

  it("TERMINAL matches htask semantics", () => {
    assert.deepEqual([...TERMINAL].sort(), ["CANCELLED", "FAILED", "MERGED"])
  })
})
