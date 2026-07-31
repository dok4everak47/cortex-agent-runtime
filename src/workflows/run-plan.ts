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
}

export async function runPlan(
  plan: PlanItem[],
  registry: Record<string, StepModule>,
  projectPath: string,
): Promise<PlanRunResult> {
  const steps: Record<string, unknown>[] = []
  let testOutput = ""

  for (const item of plan) {
    const mod = registry[item.type]

    if (!mod) {
      steps.push({ step: item.step, action: item.type, status: "failed", error: `No step registered for '${item.type}'` })
      continue
    }

    try {
      const result = await mod.execute(item.params, projectPath)
      if (item.type === "test" || item.type === "apiTest") {
        testOutput = String(result.testOutput ?? "")
      }
      steps.push({ step: item.step, action: item.type, ...result })
    } catch (err) {
      steps.push({ step: item.step, action: item.type, status: "failed", error: String(err) })
    }
  }

  return { steps, testOutput }
}
