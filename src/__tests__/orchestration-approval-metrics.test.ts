import { describe, it } from "node:test"
import assert from "node:assert"
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import {
  approvalDecision,
  loadApprovalPolicy,
  parseApprovalYaml,
} from "../domains/orchestration/state/approval.js"
import { computeMetrics, type MetricsReport } from "../domains/orchestration/metrics.js"
import type { TaskRecord } from "../domains/orchestration/state/task-store.js"

function makeProject(): string {
  return mkdtempSync(join(tmpdir(), "orchestration-approval-"))
}

function cleanup(p: string): void {
  rmSync(p, { recursive: true, force: true })
}

function basePolicy(high: boolean, low: boolean) {
  return { rules: { high_risk: high, low_risk: low }, source: "file" as const }
}

describe("parseApprovalYaml", () => {
  it("parses high_risk and low_risk booleans", () => {
    const rules = parseApprovalYaml("rules:\n  high_risk: true\n  low_risk: false\n")
    assert.equal(rules.high_risk, true)
    assert.equal(rules.low_risk, false)
  })

  it("strips inline comments after values", () => {
    const rules = parseApprovalYaml("rules:\n  low_risk: false # 自动过闸\n")
    assert.equal(rules.low_risk, false)
  })

  it("keeps '#' without preceding whitespace inside string values", () => {
    const rules = parseApprovalYaml("rules:\n  low_risk: \"abc#def\"\n")
    assert.equal(rules.low_risk, "abc#def")
  })

  it("ignores whole-line comments and blank lines", () => {
    const rules = parseApprovalYaml("# 整行注释\n\nrules:\n  # 嵌套注释\n  high_risk: true\n")
    assert.equal(rules.high_risk, true)
    assert.equal(rules.low_risk, undefined)
  })

  it("returns empty rules when no rules section", () => {
    assert.deepEqual(parseApprovalYaml("foo: bar\n"), {})
  })

  it("throws on invalid rules line", () => {
    assert.throws(() => parseApprovalYaml("rules: garbage\n"), /无效的 rules 行/)
  })

  it("parses numeric scalars", () => {
    const rules = parseApprovalYaml("rules:\n  low_risk: 0\n")
    assert.equal(rules.low_risk, 0)
  })
})

describe("loadApprovalPolicy", () => {
  it("returns conservative defaults when no approval.yaml exists", async () => {
    const p = makeProject()
    try {
      const policy = await loadApprovalPolicy(p)
      assert.deepEqual(policy, { rules: { high_risk: true, low_risk: true }, source: "default" })
    } finally {
      cleanup(p)
    }
  })

  it("merges file rules over defaults and reports source file", async () => {
    const p = makeProject()
    try {
      mkdirSync(join(p, ".htask"), { recursive: true })
      writeFileSync(join(p, ".htask", "approval.yaml"), "rules:\n  high_risk: true\n  low_risk: false\n")
      const policy = await loadApprovalPolicy(p)
      assert.equal(policy.source, "file")
      assert.deepEqual(policy.rules, { high_risk: true, low_risk: false })
    } finally {
      cleanup(p)
    }
  })

  it("falls back to defaults with a warning on a broken file", async () => {
    const p = makeProject()
    try {
      mkdirSync(join(p, ".htask"), { recursive: true })
      writeFileSync(join(p, ".htask", "approval.yaml"), "rules: not-a-mapping\n  high_risk: [")
      const policy = await loadApprovalPolicy(p)
      assert.deepEqual(policy, { rules: { high_risk: true, low_risk: true }, source: "default" })
    } finally {
      cleanup(p)
    }
  })
})

describe("approvalDecision", () => {
  it("uses high_risk rule when risk is present", () => {
    assert.equal(approvalDecision({ risk: ["database"], policy: basePolicy(true, false) }), "human")
    assert.equal(approvalDecision({ risk: ["api"], policy: basePolicy(false, true) }), "auto")
  })

  it("uses low_risk rule when risk is empty", () => {
    assert.equal(approvalDecision({ risk: [], policy: basePolicy(true, false) }), "auto")
    assert.equal(approvalDecision({ risk: [], policy: basePolicy(true, true) }), "human")
  })
})

function makeTask(partial: Partial<TaskRecord>): Partial<TaskRecord> {
  return {
    id: "task-1",
    title: "Task",
    status: "MERGED",
    history: [],
    ...partial,
  }
}

describe("computeMetrics", () => {
  it("returns an empty report for empty input", () => {
    const report = computeMetrics([])
    assert.equal(report.tasks.length, 0)
    assert.equal(report.summary.total, 0)
    assert.equal(report.summary.avgTtvMs, null)
  })

  it("marks tasks with missing timestamps as missing and excludes them from summary", () => {
    const report = computeMetrics([makeTask({ id: "t1", history: [{ from: null, to: "CREATED", at: "2026-01-01T00:00:00.000Z", by: "auto" }] })])
    const row = report.tasks[0]
    assert.ok(row.missing.includes("merged"))
    assert.ok(row.missing.includes("ttv"))
    assert.ok(row.missing.includes("wait_human"))
    assert.equal(report.summary.total, 1)
    assert.equal(report.summary.complete, 0)
    assert.equal(report.summary.missingCount, 1)
  })

  it("handles missing implementDurationMs without crashing", () => {
    const report = computeMetrics([
      makeTask({ id: "t1", implementDurationMs: null, history: [] }),
    ])
    assert.equal(report.tasks[0].implMs, null)
    assert.ok(report.tasks[0].missing.includes("impl"))
  })

  it("computes ttv/wait/impl and summary aggregates for complete tasks", () => {
    const mk = (id: string, created: string, verifying: string, accepted: string, merged: string, implMs: number) =>
      makeTask({
        id,
        history: [
          { from: null, to: "CREATED", at: created, by: "auto" },
          { from: "CREATED", to: "VERIFYING", at: verifying, by: "auto" },
          { from: "VERIFYING", to: "ACCEPTED", at: accepted, by: "alice" },
          { from: "ACCEPTED", to: "MERGED", at: merged, by: "auto" },
        ],
        implementDurationMs: implMs,
      })

    // ttv = merged - created = 4h; wait = accepted - verifying = 1h; impl = 60min
    const a = mk("a", "2026-01-01T00:00:00.000Z", "2026-01-01T02:00:00.000Z", "2026-01-01T03:00:00.000Z", "2026-01-01T04:00:00.000Z", 60_000)
    // ttv = 2h; wait = 2h; impl = 120min
    const b = mk("b", "2026-01-02T00:00:00.000Z", "2026-01-02T01:00:00.000Z", "2026-01-02T03:00:00.000Z", "2026-01-02T02:00:00.000Z", 120_000)

    const report = computeMetrics([a, b])
    assert.equal(report.tasks[0].ttvMs, 4 * 3600_000)
    assert.equal(report.tasks[0].waitHumanMs, 3600_000)
    assert.equal(report.tasks[0].implMs, 60_000)
    assert.deepEqual(report.tasks[0].missing, [])

    assert.equal(report.summary.complete, 2)
    assert.equal(report.summary.total, 2)
    assert.equal(report.summary.missingCount, 0)
    assert.equal(report.summary.avgTtvMs, 3 * 3600_000)
    assert.equal(report.summary.totalWaitMs, 3 * 3600_000)
    assert.equal(report.summary.totalImplMs, 180_000)
    // waitRatio = wait / (wait + impl) = 10800000 / 10980000
    assert.ok(report.summary.waitRatio !== null)
  })

  it("ranks bottlenecks by descending wait time, limited to 3", () => {
    const mk = (id: string, waitH: number, created: string) =>
      makeTask({
        id,
        history: [
          { from: null, to: "CREATED", at: created, by: "auto" },
          { from: "CREATED", to: "VERIFYING", at: "2026-01-01T01:00:00.000Z", by: "auto" },
          { from: "VERIFYING", to: "ACCEPTED", at: new Date(new Date("2026-01-01T01:00:00.000Z").getTime() + waitH * 3600_000).toISOString(), by: "alice" },
          { from: "ACCEPTED", to: "MERGED", at: new Date(new Date("2026-01-01T01:00:00.000Z").getTime() + waitH * 3600_000 + 3600_000).toISOString(), by: "auto" },
        ],
        implementDurationMs: 60_000,
      })

    const a = mk("slowest", 10, "2026-01-01T00:00:00.000Z")
    const b = mk("middle", 5, "2026-01-02T00:00:00.000Z")
    const c = mk("fast", 1, "2026-01-03T00:00:00.000Z")
    const d = mk("d", 7, "2026-01-04T00:00:00.000Z")

    const report = computeMetrics([a, b, c, d]) as MetricsReport
    assert.deepEqual(
      report.summary.bottlenecks.map((x) => x.id),
      ["slowest", "d", "middle"]
    )
  })
})
