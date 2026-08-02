import { existsSync } from "fs"
import { join } from "path"
import { getConfig } from "../../../core/mcp.js"
import { success, failure } from "../../../core/tool-helper.js"
import { readAllTasks, type TaskRecord } from "../state/task-store.js"
import { TERMINAL, type TaskStatus } from "../state/state-machine.js"

const NEXT_STEP: Record<string, string> = {
  CREATED: "未开始",
  PLANNING: "规划中",
  IMPLEMENTING: "实现中",
  REVIEWING: "审查中",
  VERIFYING: "等待人工: htask accept",
  ACCEPTED: "可继续: htask merge",
  MERGED: "已完成",
  FAILED: "失败: 需人工介入",
  CANCELLED: "已取消",
}

const STALE_THRESHOLDS: Record<string, { min: number; msg: string }> = {
  IMPLEMENTING: { min: 30, msg: "opencode 可能挂了" },
  REVIEWING: { min: 15, msg: "reviewer 可能挂了" },
  VERIFYING: { min: 60, msg: "等待人工 accept 太久" },
  ACCEPTED: { min: 24 * 60, msg: "等待 merge 太久" },
}

export function nextStep(status?: string): string {
  return NEXT_STEP[status ?? ""] ?? "-"
}

// 卡住检测: 非终态且停留超过阈值 → { reason }, 否则 null
export function staleInfo(task: Partial<TaskRecord> | null | undefined): { reason: string } | null {
  if (!task || !task.status || TERMINAL.has(task.status as TaskStatus)) return null
  const t = STALE_THRESHOLDS[task.status]
  if (!t) return null
  const updated = task.updatedAt ? new Date(task.updatedAt).getTime() : Date.now()
  const minutes = (Date.now() - updated) / 60000
  return minutes > t.min ? { reason: `${task.status} 停留超过 ${t.min}min, ${t.msg}` } : null
}

// 分诊状态: RUNNING / WAITING_HUMAN / BLOCKED / DONE / STALE
export function deriveState(task: Partial<TaskRecord>): string {
  const status = task?.status
  if (status === "MERGED") return "DONE"
  if (status === "FAILED" || status === "CANCELLED") return "BLOCKED"
  if (status === "VERIFYING") {
    if (staleInfo(task)) return "STALE"
    const verify = Array.isArray(task.verify) ? task.verify : []
    return verify.every((r) => r.exitCode === 0) ? "WAITING_HUMAN" : "BLOCKED"
  }
  if (status === "ACCEPTED" || status === "CREATED") return staleInfo(task) ? "STALE" : "WAITING_HUMAN"
  if (status === "PLANNING" || status === "IMPLEMENTING" || status === "REVIEWING") {
    return staleInfo(task) ? "STALE" : "RUNNING"
  }
  return "BLOCKED"
}

function fmtDuration(ms: number): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "-"
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m}m${sec}s`
}

function dwellMs(task: Partial<TaskRecord>): number {
  const upd = task.updatedAt ? new Date(task.updatedAt).getTime() : Date.now()
  return Math.max(0, Date.now() - upd)
}

function pad(s: string, n: number): string {
  s = String(s ?? "")
  return s.length >= n ? s : s + " ".repeat(n - s.length)
}

export async function executeTaskStatus() {
  try {
    const { projectPath } = getConfig()
    if (!existsSync(join(projectPath, ".htask"))) {
      return success("(no .htask directory — no tasks yet; run htask start to create one)")
    }
    const tasks = await readAllTasks(projectPath)
    if (tasks.length === 0) {
      return success("(no tasks)")
    }

    const rows = tasks.map((t) => {
      const stale = staleInfo(t)
      return {
        id: String(t.id ?? "-"),
        title: String(t.title ?? "-"),
        status: String(t.status ?? "-"),
        state: deriveState(t),
        next: nextStep(t.status),
        dwell: fmtDuration(dwellMs(t)),
        stale: stale ? `⚠️ 卡住 (${stale.reason})` : "",
      }
    })
    const w = {
      id: Math.max(2, ...rows.map((r) => r.id.length)),
      title: Math.max(4, ...rows.map((r) => r.title.length)),
      status: Math.max(4, ...rows.map((r) => r.status.length)),
      state: Math.max(5, ...rows.map((r) => r.state.length)),
      next: Math.max(4, ...rows.map((r) => r.next.length)),
      dwell: Math.max(4, ...rows.map((r) => r.dwell.length)),
    }
    const lines: string[] = []
    lines.push(
      `${pad("ID", w.id)}  ${pad("标题", w.title)}  ${pad("状态", w.status)}  ${pad("state", w.state)}  ${pad("下一步", w.next)}  ${pad("停留", w.dwell)}  卡住`
    )
    for (const r of rows) {
      lines.push(
        `${pad(r.id, w.id)}  ${pad(r.title, w.title)}  ${pad(r.status, w.status)}  ${pad(r.state, w.state)}  ${pad(r.next, w.next)}  ${pad(r.dwell, w.dwell)}  ${r.stale}`
      )
    }
    const byStatus: Record<string, number> = {}
    for (const t of tasks) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1
    const summary = Object.entries(byStatus)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · ")
    lines.push("")
    lines.push(`状态摘要: 共 ${tasks.length} 个任务 · ${summary}`)
    return success(lines.join("\n"))
  } catch (err) {
    return failure("taskStatus", err)
  }
}
