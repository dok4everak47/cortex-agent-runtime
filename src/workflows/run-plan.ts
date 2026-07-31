import { RunStateStore, type RunRecord, type RunStatus, type StepStatus } from "./run-state.js"

export type StepOutput = {
  status: "done" | "skipped" | "failed"
  [key: string]: unknown
}

export type StepModule = {
  execute: (params: Record<string, unknown>, projectPath: string) => StepOutput | Promise<StepOutput>
}

export type PlanItem = {
  step: number
  type: string
  params: Record<string, unknown>
  optional?: boolean
}

export type PlanRunResult = {
  steps: Record<string, unknown>[]
  testOutput: string
  runId: string
  runStatus: RunStatus
  context?: Record<string, unknown>
}

export type RunPlanOptions = {
  workflow?: string
  entity?: string
  args?: Record<string, unknown>
  resumeFrom?: string
  mergeContext?: boolean
  stopOnFailure?: boolean
  trackArtifacts?: boolean
  skipResolved?: boolean
}

function normalizeFile(file: string): string[] {
  return file
    .split(",")
    .map(f => f.trim())
    .filter(Boolean)
}

export async function runPlan(
  plan: PlanItem[],
  registry: Record<string, StepModule>,
  projectPath: string,
  options: RunPlanOptions = {},
): Promise<PlanRunResult> {
  const store = new RunStateStore(projectPath)
  const workflow = options.workflow ?? "workflow"
  const entity = options.entity ?? "entity"
  const mergeContext = options.mergeContext ?? false
  const stopOnFailure = options.stopOnFailure ?? true
  const trackArtifacts = options.trackArtifacts ?? true
  const skipResolved = options.skipResolved ?? true

  let run: RunRecord
  if (options.resumeFrom) {
    const existing = store.get(options.resumeFrom)
    if (!existing) throw new Error(`Run ${options.resumeFrom} not found`)
    run = existing
  } else {
    run = store.create(workflow, entity, options.args)
    run.steps = plan.map(item => ({ step: item.step, name: item.type, status: "pending" as StepStatus }))
    store.save(run)
  }

  const results: Record<string, unknown>[] = []
  const context: Record<string, unknown> = {}
  let testOutput = ""

  for (const item of plan) {
    const existing = run.steps.find(s => s.step === item.step)

    if (options.resumeFrom && skipResolved && existing?.status === "success") {
      results.push({ step: item.step, action: item.type, status: "success", resumed: true })
      continue
    }

    const mod = registry[item.type]
    if (!mod) {
      store.updateStep(run, item.step, "failed", `No step registered for '${item.type}'`)
      results.push({ step: item.step, action: item.type, status: "failed", error: `No step registered for '${item.type}'` })
      continue
    }

    store.updateStep(run, item.step, "running")

    try {
      const params = mergeContext ? { ...item.params, ...context } : item.params
      const result = await mod.execute(params, projectPath)

      if (item.type === "test" || item.type === "apiTest") {
        testOutput = String(result.testOutput ?? "")
      }

      if (result.status === "failed") {
        const detail = typeof result.error === "string" ? result.error : "step failed"
        store.updateStep(run, item.step, "failed", detail)
        results.push({ step: item.step, action: item.type, ...result })
        if (mergeContext) context[item.type] = result
        if (stopOnFailure) {
          for (const rest of plan.filter(p => p.step > item.step)) {
            store.updateStep(run, rest.step, "skipped", "previous step failed")
            results.push({ step: rest.step, action: rest.type, status: "skipped", error: "previous step failed" })
          }
          break
        }
        continue
      }

      const status: StepStatus = "success"
      const detail = typeof result.file === "string" && result.file
        ? result.file
        : typeof result.error === "string" ? result.error : undefined
      store.updateStep(run, item.step, status, detail)

      if (trackArtifacts && typeof result.file === "string" && result.file) {
        for (const f of normalizeFile(result.file)) {
          if (!run.artifacts.includes(f)) run.artifacts.push(f)
        }
        store.save(run)
      }

      if (mergeContext) context[item.type] = result
      results.push({ step: item.step, action: item.type, ...result })
    } catch (err) {
      store.updateStep(run, item.step, "failed", String(err))
      results.push({ step: item.step, action: item.type, status: "failed", error: String(err) })
      for (const rest of plan.filter(p => p.step > item.step)) {
        store.updateStep(run, rest.step, "skipped", "previous step failed")
        results.push({ step: rest.step, action: rest.type, status: "skipped", error: "previous step failed" })
      }
      break
    }
  }

  const anyFailed = run.steps.some(s => s.status === "failed")
  const allDone =
    run.steps.length >= plan.length &&
    run.steps.every(s => s.status === "success" || s.status === "skipped")
  if (anyFailed) {
    store.markFailed(run)
  } else if (allDone) {
    store.markSuccess(run)
  } else {
    store.markFailed(run)
  }

  const result: PlanRunResult = { steps: results, testOutput, runId: run.id, runStatus: run.status }
  if (mergeContext) result.context = context
  return result
}
