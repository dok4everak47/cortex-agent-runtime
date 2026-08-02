import type { TaskRecord } from "./state/task-store.js"

export interface MetricsRow {
  id: string
  title: string
  status: string
  created: string | null
  verifying: string | null
  accepted: string | null
  merged: string | null
  ttvMs: number | null
  implMs: number | null
  waitHumanMs: number | null
  missing: string[]
}

export interface MetricsReport {
  tasks: MetricsRow[]
  summary: {
    total: number
    complete: number
    missingCount: number
    avgTtvMs: number | null
    totalWaitMs: number
    totalImplMs: number
    waitRatio: number | null
    bottlenecks: { id: string; waitHumanMs: number }[]
  }
}

// 从任务 history 提取首次到达某状态的 at 时间戳 (to=状态 的 at)
function historyAt(task: Partial<TaskRecord>, status: string): string | null {
  const history = Array.isArray(task?.history) ? task.history : []
  for (const h of history) {
    if (h && h.to === status && h.at) return h.at
  }
  return null
}

// 纯函数: 每任务 TTV/实现耗时/等人 accept 耗时 + 汇总 (平均 TTV、等待占比、瓶颈排序)
//  - TTV = merged - created；wait_human = accepted - verifying；impl = implementDurationMs
//  - 缺 history / 缺阶段时间戳的任务不 crash, 标 missing, 不参与汇总
export function computeMetrics(tasks: Array<Partial<TaskRecord>>): MetricsReport {
  const rows: MetricsRow[] = (Array.isArray(tasks) ? tasks : []).map((task) => {
    const hasHistory = Array.isArray(task?.history) && task.history.length > 0
    const created = hasHistory ? historyAt(task, "CREATED") : null
    const verifying = hasHistory ? historyAt(task, "VERIFYING") : null
    const accepted = hasHistory ? historyAt(task, "ACCEPTED") : null
    const merged = hasHistory ? historyAt(task, "MERGED") : null

    const diffMs = (a: string | null, b: string | null): number | null => {
      if (!a || !b) return null
      const ta = new Date(a).getTime()
      const tb = new Date(b).getTime()
      if (!Number.isFinite(ta) || !Number.isFinite(tb)) return null
      return Math.max(0, tb - ta)
    }

    const ttv = diffMs(created, merged)
    const waitHuman = diffMs(verifying, accepted)
    const impl =
      typeof task.implementDurationMs === "number" && Number.isFinite(task.implementDurationMs)
        ? task.implementDurationMs
        : null

    const missing: string[] = []
    if (!hasHistory) missing.push("history")
    if (!merged) missing.push("merged")
    if (!accepted) missing.push("accepted")
    if (ttv === null) missing.push("ttv")
    if (waitHuman === null) missing.push("wait_human")
    if (impl === null) missing.push("impl")

    return {
      id: task.id ?? "-",
      title: task.title ?? "-",
      status: task.status ?? "-",
      created,
      verifying,
      accepted,
      merged,
      ttvMs: ttv,
      implMs: impl,
      waitHumanMs: waitHuman,
      missing,
    }
  })

  // 汇总只统计 TTV/等待/实现齐全的任务, 缺失任务计入 missingCount
  const complete = rows.filter((r) => r.ttvMs !== null && r.waitHumanMs !== null && r.implMs !== null)
  const avg = (arr: number[]): number | null => (arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length)
  const sum = (arr: number[]): number => arr.reduce((a, b) => a + b, 0)
  const totalWait = sum(complete.map((r) => r.waitHumanMs as number))
  const totalImpl = sum(complete.map((r) => r.implMs as number))
  const waitRatio = totalWait + totalImpl > 0 ? totalWait / (totalWait + totalImpl) : null
  const bottlenecks = complete
    .slice()
    .sort((a, b) => (b.waitHumanMs as number) - (a.waitHumanMs as number))
    .map((r) => ({ id: r.id, waitHumanMs: r.waitHumanMs as number }))

  return {
    tasks: rows,
    summary: {
      total: rows.length,
      complete: complete.length,
      missingCount: rows.length - complete.length,
      avgTtvMs: avg(complete.map((r) => r.ttvMs as number)),
      totalWaitMs: totalWait,
      totalImplMs: totalImpl,
      waitRatio,
      bottlenecks: bottlenecks.slice(0, 3),
    },
  }
}
