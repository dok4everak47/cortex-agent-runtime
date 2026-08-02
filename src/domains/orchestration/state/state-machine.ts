import { readTask, writeTask } from "./task-store.js"

export const STATES = [
  "CREATED",
  "PLANNING",
  "IMPLEMENTING",
  "REVIEWING",
  "VERIFYING",
  "ACCEPTED",
  "MERGED",
  "FAILED",
  "CANCELLED",
] as const

export type TaskStatus = (typeof STATES)[number]

export const TERMINAL: ReadonlySet<TaskStatus> = new Set(["MERGED", "FAILED", "CANCELLED"])

export const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  CREATED: ["PLANNING", "FAILED", "CANCELLED"],
  PLANNING: ["IMPLEMENTING", "FAILED", "CANCELLED"],
  IMPLEMENTING: ["REVIEWING", "VERIFYING", "FAILED", "CANCELLED"],
  REVIEWING: ["VERIFYING", "FAILED", "CANCELLED"],
  VERIFYING: ["ACCEPTED", "FAILED", "CANCELLED"],
  ACCEPTED: ["MERGED", "CANCELLED"],
  MERGED: [],
  FAILED: ["PLANNING"],
  CANCELLED: [],
}

export interface HistoryEntry {
  from: string | null
  to: string
  at: string
  by: string
}

// 校验迁移合法 (TRANSITIONS 表) 后推进: 追加 history, 更新 status/updatedAt, 终态写 endedAt。
// 同状态迁移幂等返回原任务; 离开终态 (retry) 清除 endedAt。
export async function transition(cwd: string, id: string, to: TaskStatus, by = "auto") {
  const task = await readTask(cwd, id)
  if (!task) throw new Error(`任务不存在: ${id}`)
  const from = task.status
  if (from === to) return task
  const allowed = TRANSITIONS[from] ?? []
  if (!allowed.includes(to)) {
    throw new Error(`非法迁移: ${from} → ${to}`)
  }
  task.history = task.history ?? []
  task.history.push({ from, to, at: new Date().toISOString(), by })
  task.status = to
  task.updatedAt = new Date().toISOString()
  if (TERMINAL.has(from)) task.endedAt = null
  if (TERMINAL.has(to)) task.endedAt = task.endedAt ?? task.updatedAt
  await writeTask(cwd, task)
  return task
}
