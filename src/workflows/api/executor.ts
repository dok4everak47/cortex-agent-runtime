import { makeApiPlan } from "./planner.js"
import { runPlan } from "../run-plan.js"
import * as migrationStep from "./steps/migration.js"
import * as modelStep from "./steps/model.js"
import * as apiControllerStep from "./steps/api-controller.js"
import * as requestStep from "./steps/request.js"
import * as apiRouteStep from "./steps/api-route.js"
import * as testStep from "./steps/test.js"

const STEP_REGISTRY = {
  migration: migrationStep,
  model: modelStep,
  apiController: apiControllerStep,
  request: requestStep,
  apiRoute: apiRouteStep,
  test: testStep,
}

export async function executeApiPlan(
  entity: string,
  fields: string | undefined,
  auth: boolean,
  projectPath: string,
): Promise<{ steps: Record<string, unknown>[]; testOutput: string }> {
  const plan = makeApiPlan(entity, fields, auth)
  return runPlan(plan, STEP_REGISTRY, projectPath)
}
