import { makeFeaturePlan, type FeatureOptions } from "./planner.js"
import { runPlan } from "../run-plan.js"
import * as migrationStep from "./steps/migration.js"
import * as modelStep from "./steps/model.js"
import * as controllerStep from "./steps/controller.js"
import * as requestStep from "./steps/request.js"
import * as routeStep from "./steps/route.js"
import * as viewsStep from "./steps/views.js"
import * as testStep from "./steps/test.js"
import * as apiControllerStep from "../api/steps/api-controller.js"
import * as apiRouteStep from "../api/steps/api-route.js"
import * as apiTestStep from "../api/steps/test.js"

const STEP_REGISTRY = {
  migration: migrationStep,
  model: modelStep,
  controller: controllerStep,
  apiController: apiControllerStep,
  request: requestStep,
  route: routeStep,
  apiRoute: apiRouteStep,
  views: viewsStep,
  test: testStep,
  apiTest: apiTestStep,
}

export async function executeFeaturePlan(
  entity: string,
  fields: string | undefined,
  options: FeatureOptions,
  projectPath: string,
): Promise<{ steps: Record<string, unknown>[]; testOutput: string }> {
  const plan = makeFeaturePlan(entity, fields, options)
  return runPlan(plan, STEP_REGISTRY, projectPath)
}
