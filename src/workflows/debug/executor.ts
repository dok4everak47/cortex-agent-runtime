import { makeDebugPlan } from "./planner.js"
import * as locateStep from "./steps/locate.js"
import * as analyzeStep from "./steps/analyze.js"
import * as diagnoseStep from "./steps/diagnose.js"
import * as suggestStep from "./steps/suggest.js"
import type { PlanItem, StepModule, StepOutput } from "../run-plan.js"

const STEP_REGISTRY: Record<string, StepModule> = {
  locate: locateStep,
  analyze: analyzeStep,
  diagnose: diagnoseStep,
  suggest: suggestStep,
}

export async function executeDebugPlan(
  error: string,
  file: string | undefined,
  projectPath: string,
): Promise<{ steps: Record<string, unknown>[]; context: Record<string, unknown> }> {
  const plan = makeDebugPlan(error, file)
  const steps: Record<string, unknown>[] = []
  const context: Record<string, unknown> = {}

  for (const item of plan as PlanItem[]) {
    const mod = STEP_REGISTRY[item.type]
    const merged = { ...item.params, ...context }
    const result: StepOutput = await mod.execute(merged, projectPath)
    context[item.type] = result
    steps.push({ step: item.step, action: item.type, ...result })
  }

  return { steps, context }
}
