import { existsSync } from "fs"
import { join } from "path"
import { getConfig } from "../../../core/mcp.js"
import { success, failure } from "../../../core/tool-helper.js"
import { readAllTasks } from "../state/task-store.js"
import { computeMetrics, type MetricsRow } from "../metrics.js"

function fmtDuration(ms: number | null): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "-"
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m}m${sec}s`
}

function pad(s: string, n: number): string {
  s = String(s ?? "")
  return s.length >= n ? s : s + " ".repeat(n - s.length)
}

export async function executeTaskMetrics() {
  try {
    const { projectPath } = getConfig()
    if (!existsSync(join(projectPath, ".htask"))) {
      return success("(no .htask directory — no metrics to compute)")
    }
    const tasks = await readAllTasks(projectPath)
    const { tasks: rows, summary } = computeMetrics(tasks)
    if (rows.length === 0) {
      return success("(no tasks)")
    }

    const fmt = (ms: number | null): string => fmtDuration(ms)
    const mark = (r: MetricsRow): string => (r.missing.length === 0 ? "" : ` ⚠️缺${r.missing.join("/")}`)
    const w = {
      id: Math.max(2, ...rows.map((r) => String(r.id).length)),
      ttv: Math.max(3, ...rows.map((r) => fmt(r.ttvMs).length)),
      impl: Math.max(6, ...rows.map((r) => fmt(r.implMs).length)),
      wait: Math.max(10, ...rows.map((r) => fmt(r.waitHumanMs).length)),
      status: Math.max(4, ...rows.map((r) => String(r.status).length)),
    }
    const lines: string[] = []
    lines.push(`${pad("ID", w.id)}  ${pad("TTV", w.ttv)}  ${pad("实现", w.impl)}  ${pad("等人 accept", w.wait)}  ${pad("状态", w.status)}  备注`)
    for (const r of rows) {
      lines.push(
        `${pad(r.id, w.id)}  ${pad(fmt(r.ttvMs), w.ttv)}  ${pad(fmt(r.implMs), w.impl)}  ${pad(fmt(r.waitHumanMs), w.wait)}  ${pad(r.status, w.status)}  ${mark(r)}`
      )
    }

    lines.push("")
    lines.push(
      `汇总: ${summary.complete}/${summary.total} 任务完整 · 平均 TTV ${fmt(summary.avgTtvMs)} · 总等待 ${fmt(summary.totalWaitMs)} vs 总实现 ${fmt(summary.totalImplMs)} · 等待占比 ${summary.waitRatio !== null ? `${(summary.waitRatio * 100).toFixed(1)}%` : "-"}`
    )
    if (summary.bottlenecks.length > 0) {
      lines.push(`瓶颈: ${summary.bottlenecks.map((b) => `${b.id} (${fmt(b.waitHumanMs)})`).join(" > ")}`)
    }
    if (summary.missingCount > 0) {
      lines.push(`⚠️ ${summary.missingCount} 个任务缺 TTV/等待/实现数据, 未计入汇总`)
    }
    return success(lines.join("\n"))
  } catch (err) {
    return failure("taskMetrics", err)
  }
}
