import { makeDebugPlan } from "./planner.js"
import * as locateStep from "./steps/locate.js"
import * as analyzeStep from "./steps/analyze.js"
import * as diagnoseStep from "./steps/diagnose.js"
import * as suggestStep from "./steps/suggest.js"
import { runPlan, type PlanRunResult } from "../run-plan.js"

const STEP_REGISTRY: Record<string, import("../run-plan.js").StepModule> = {
  locate: locateStep,
  analyze: analyzeStep,
  diagnose: diagnoseStep,
  suggest: suggestStep,
}

export async function executeDebugPlan(
  error: string,
  file: string | undefined,
  projectPath: string,
  resumeFrom?: string,
): Promise<PlanRunResult & { context: Record<string, unknown> }> {
  const plan = makeDebugPlan(error, file)
  const result = await runPlan(plan, STEP_REGISTRY, projectPath, {
    workflow: "debugWorkflow",
    entity: file?.trim() || "error",
    args: { error, file },
    resumeFrom,
    mergeContext: true,
    stopOnFailure: false,
    trackArtifacts: false,
    skipResolved: false,
  })
  return { ...result, context: result.context ?? {} }
}
