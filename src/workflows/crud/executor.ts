import { makePlan } from "./planner.js"
import { runPlan, type PlanRunResult } from "../run-plan.js"
import * as migrationStep from "./steps/migration.js"
import * as modelStep from "./steps/model.js"
import * as controllerStep from "./steps/controller.js"
import * as requestStep from "./steps/request.js"
import * as routeStep from "./steps/route.js"
import * as testStep from "./steps/test.js"

const STEP_REGISTRY = {
  migration: migrationStep,
  model: modelStep,
  controller: controllerStep,
  request: requestStep,
  route: routeStep,
  test: testStep,
}

export async function executePlan(
  entity: string,
  fields: string | undefined,
  table: string | undefined,
  projectPath: string,
  resumeFrom?: string,
): Promise<PlanRunResult> {
  const plan = makePlan(entity, fields, table)
  return runPlan(plan, STEP_REGISTRY, projectPath, {
    workflow: "crudGenerator",
    entity,
    args: { entity, fields: fields ?? "", table },
    resumeFrom,
  })
}
