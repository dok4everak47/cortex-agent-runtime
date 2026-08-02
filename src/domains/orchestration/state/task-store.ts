import { mkdir, readFile, readdir, writeFile } from "fs/promises"
import { basename, join } from "path"
import type { HistoryEntry, TaskStatus } from "./state-machine.js"
import { TERMINAL } from "./state-machine.js"

export const DEFAULT_MODEL = "deepseek/deepseek-v4-flash"

export interface Plan {
  complexity?: string
  risk?: string[]
  pipeline?: string[]
  estimated?: { files?: number; minutes?: number }
  suggestModel?: string
  suggestReview?: boolean
  approval?: string
}

export interface VerifyResult {
  command: string
  exitCode: number
  output?: string
}

export interface TaskRecord {
  id: string
  title: string
  status: TaskStatus
  agent: string | null
  agentBackend?: string | null
  model: string
  taskFile: string
  plan: Plan | null
  review: unknown | null
  verification: unknown | null
  history: HistoryEntry[]
  startedAt: string
  updatedAt: string
  endedAt: string | null
  implementExit: number | string | null
  implementDurationMs: number | null
  verify: VerifyResult[]
}

export interface TaskMeta {
  id?: string
  title?: string
  agent?: string | null
  agentBackend?: string | null
  model?: string
  taskFile?: string
}

export interface StateFile {
  currentId?: string
  status?: string
  title?: string
  taskFile?: string
  agent?: string | null
  model?: string
  startedAt?: string
  endedAt?: string
  implementExit?: number | string | null
  implementDurationMs?: number | null
  verify?: unknown
}

// task-YYYYMMDD-<slug>: 日期 + 标题前 12 字符 (去非字母数字, 小写)
export function newTaskId(title = ""): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const slug = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 12)
  return `task-${date}-${slug || "task"}`
}

function tasksDir(cwd: string): string {
  return join(cwd, ".htask", "tasks")
}

function taskPath(cwd: string, id: string): string {
  return join(tasksDir(cwd), `${id}.json`)
}

function statePath(cwd: string): string {
  return join(cwd, ".htask", "state.json")
}

export async function writeTask(cwd: string, task: TaskRecord): Promise<void> {
  const dir = tasksDir(cwd)
  await mkdir(dir, { recursive: true })
  await writeFile(taskPath(cwd, task.id), JSON.stringify(task, null, 2) + "\n")
}

export async function readTask(cwd: string, id: string): Promise<TaskRecord | null> {
  try {
    const raw = await readFile(taskPath(cwd, id), "utf8")
    return JSON.parse(raw) as TaskRecord
  } catch {
    return null
  }
}

export async function readAllTasks(cwd: string): Promise<TaskRecord[]> {
  let names: string[]
  try {
    names = await readdir(tasksDir(cwd))
  } catch {
    return []
  }
  const tasks: TaskRecord[] = []
  for (const n of names) {
    if (!n.endsWith(".json")) continue
    try {
      const t = JSON.parse(await readFile(join(tasksDir(cwd), n), "utf8")) as TaskRecord
      if (t && t.id) tasks.push(t)
    } catch {
      // 跳过损坏文件
    }
  }
  tasks.sort((a, b) => String(a.startedAt ?? "").localeCompare(String(b.startedAt ?? "")))
  return tasks
}

export async function readState(cwd: string): Promise<StateFile | null> {
  try {
    const raw = await readFile(statePath(cwd), "utf8")
    return JSON.parse(raw) as StateFile
  } catch {
    return null
  }
}

export async function writeState(cwd: string, state: StateFile): Promise<void> {
  await mkdir(join(cwd, ".htask"), { recursive: true })
  await writeFile(statePath(cwd), JSON.stringify(state, null, 2) + "\n")
}

// 创建任务: 写 tasks/<id>.json (状态 CREATED), 更新 state.json 指针
export async function createTask(cwd: string, meta: TaskMeta = {}): Promise<TaskRecord> {
  const id = meta.id || newTaskId(meta.title || "task")
  const now = new Date().toISOString()
  const task: TaskRecord = {
    id,
    title: meta.title ?? "未知任务",
    status: "CREATED",
    agent: meta.agent ?? null,
    agentBackend: meta.agentBackend ?? null,
    model: meta.model ?? DEFAULT_MODEL,
    taskFile: meta.taskFile ?? "TASK.md",
    plan: null,
    review: null,
    verification: null,
    history: [{ from: null, to: "CREATED", at: now, by: "auto" }],
    startedAt: now,
    updatedAt: now,
    endedAt: null,
    implementExit: null,
    implementDurationMs: null,
    verify: [],
  }
  await writeTask(cwd, task)
  await writeState(cwd, { currentId: id })
  return task
}

const LEGACY_STATUS_MAP: Record<string, TaskStatus> = {
  running: "IMPLEMENTING",
  implementing: "IMPLEMENTING",
  verifying: "VERIFYING",
  done: "VERIFYING",
  failed: "FAILED",
}

// 旧格式 state.json (含 status) 首次读取时: 迁移到 tasks/<legacy-id>.json, 写指针。幂等: 已是指针格式返回 null。
export async function migrateLegacyState(cwd: string): Promise<TaskRecord | null> {
  const raw = await readState(cwd)
  if (!raw || typeof raw !== "object") return null
  if (raw.currentId) return null

  const started = raw.startedAt ? new Date(raw.startedAt) : new Date()
  const dateStr = started.toISOString().slice(0, 10).replace(/-/g, "")
  const id = `task-${dateStr}-legacy`
  const now = new Date().toISOString()

  const newStatus = LEGACY_STATUS_MAP[raw.status ?? ""] ?? "VERIFYING"
  const updated = raw.endedAt ?? raw.startedAt ?? now

  const task: TaskRecord = {
    id,
    title: raw.title ?? basename(raw.taskFile ?? "TASK.md"),
    status: newStatus,
    agent: raw.agent ?? null,
    model: raw.model ?? DEFAULT_MODEL,
    taskFile: raw.taskFile ?? "TASK.md",
    plan: null,
    review: null,
    verification: null,
    history: [{ from: "CREATED", to: newStatus, at: raw.startedAt ?? now, by: "migration" }],
    startedAt: raw.startedAt ?? now,
    updatedAt: updated,
    endedAt: TERMINAL.has(newStatus) ? updated : null,
    implementExit: raw.implementExit ?? null,
    implementDurationMs: raw.implementDurationMs ?? null,
    verify: Array.isArray(raw.verify) ? (raw.verify as VerifyResult[]) : [],
  }
  await writeTask(cwd, task)
  await writeState(cwd, { currentId: id })
  return task
}

// 读 state.json 指针 → tasks/<id>.json; 旧格式自动迁移
export async function currentTask(cwd: string): Promise<TaskRecord | null> {
  const state = await readState(cwd)
  if (!state) return null
  if (state.currentId) return readTask(cwd, state.currentId)
  return migrateLegacyState(cwd)
}
