import { makePlan } from "./planner.js"
import * as migrationStep from "./steps/migration.js"
import * as modelStep from "./steps/model.js"
import * as controllerStep from "./steps/controller.js"
import * as requestStep from "./steps/request.js"
import * as routeStep from "./steps/route.js"
import * as testStep from "./steps/test.js"

const STEP_REGISTRY: Record<string, { execute: Function }> = {
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
): Promise<{ steps: Record<string, unknown>[]; testOutput: string }> {
  const plan = makePlan(entity, fields, table)
  const steps: Record<string, unknown>[] = []
  let testOutput = ""

  for (const item of plan) {
    const mod = STEP_REGISTRY[item.type]
    const result: Record<string, unknown> = await mod.execute(item.params, projectPath)

    if (item.type === "test" && result.testOutput) {
      testOutput = result.testOutput as string
    }

    steps.push({ step: item.step, action: item.type, ...result })
  }

  return { steps, testOutput }
}
