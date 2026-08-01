import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs"
import { join } from "path"

export type StepStatus = "pending" | "running" | "success" | "failed" | "skipped"

export type RunStep = {
  step: number
  name: string
  status: StepStatus
  detail?: string
}

export type RunStatus = "running" | "success" | "failed" | "rolled_back"

export type RunRecord = {
  id: string
  workflow: string
  entity: string
  args?: Record<string, unknown>
  startedAt: number
  updatedAt: number
  status: RunStatus
  steps: RunStep[]
  artifacts: string[]
}

export function formatRunId(ts: number, workflow: string, entity: string): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, "0")
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  const slug = (s: string) =>
    s.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase()
  const w = slug(workflow) || "workflow"
  const e = slug(entity)
  return e ? `${stamp}-${w}-${e}` : `${stamp}-${w}`
}

export class RunStateStore {
  private baseDir: string

  constructor(projectPath: string) {
    this.baseDir = join(projectPath, ".mcp", "runs")
  }

  private ensureDir(): void {
    mkdirSync(this.baseDir, { recursive: true })
  }

  private fileFor(id: string): string {
    return join(this.baseDir, `${id}.json`)
  }

  save(record: RunRecord): void {
    this.ensureDir()
    writeFileSync(this.fileFor(record.id), JSON.stringify(record, null, 2))
  }

  create(workflow: string, entity: string, args?: Record<string, unknown>): RunRecord {
    const now = Date.now()
    const base = formatRunId(now, workflow, entity)
    let id = base
    let seq = 2
    while (existsSync(this.fileFor(id))) {
      id = `${base}-${seq}`
      seq += 1
    }
    const record: RunRecord = {
      id,
      workflow,
      entity,
      args,
      startedAt: now,
      updatedAt: now,
      status: "running",
      steps: [],
      artifacts: [],
    }
    this.save(record)
    return record
  }

  updateStep(record: RunRecord, step: number, status: StepStatus, detail?: string): void {
    const existing = record.steps.find(s => s.step === step)
    if (existing) {
      existing.status = status
      if (detail !== undefined) existing.detail = detail
    } else {
      record.steps.push({ step, name: `step ${step}`, status, detail })
    }
    record.updatedAt = Date.now()
    this.save(record)
  }

  markSuccess(record: RunRecord): void {
    record.status = "success"
    record.updatedAt = Date.now()
    this.save(record)
  }

  markFailed(record: RunRecord): void {
    record.status = "failed"
    record.updatedAt = Date.now()
    this.save(record)
  }

  list(): RunRecord[] {
    if (!existsSync(this.baseDir)) return []
    const records: RunRecord[] = []
    for (const f of readdirSync(this.baseDir)) {
      if (!f.endsWith(".json")) continue
      try {
        records.push(JSON.parse(readFileSync(join(this.baseDir, f), "utf-8")) as RunRecord)
      } catch {
        continue
      }
    }
    return records.sort((a, b) => b.startedAt - a.startedAt).slice(0, 20)
  }

  get(id: string): RunRecord | null {
    if (!existsSync(this.fileFor(id))) return null
    try {
      return JSON.parse(readFileSync(this.fileFor(id), "utf-8")) as RunRecord
    } catch {
      return null
    }
  }

  findLast(workflow: string, entity: string, status?: string): RunRecord | null {
    const matches = this.list().filter(r => {
      if (r.workflow !== workflow) return false
      if (r.entity !== entity) return false
      if (status && r.status !== status) return false
      return true
    })
    return matches.length > 0 ? matches[0] : null
  }
}

export function rollbackRun(projectPath: string, runId: string): RunRecord {
  const store = new RunStateStore(projectPath)
  const run = store.get(runId)
  if (!run) throw new Error(`Run ${runId} not found`)

  for (const file of [...run.artifacts].reverse()) {
    const abs = join(projectPath, file)
    if (existsSync(abs)) rmSync(abs)
  }

  for (const file of [...run.artifacts].reverse()) {
    let dir = join(projectPath, file, "..")
    while (dir !== projectPath && dir.startsWith(projectPath)) {
      try {
        const entries = readdirSync(dir)
        if (entries.length > 0) break
        rmSync(dir, { recursive: true })
        dir = join(dir, "..")
      } catch {
        break
      }
    }
  }

  run.status = "rolled_back"
  run.updatedAt = Date.now()
  store.save(run)
  return run
}
