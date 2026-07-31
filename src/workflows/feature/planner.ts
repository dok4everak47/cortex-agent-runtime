import { parseFields, pluralize, snakeCase, toPascalCase } from "../crud/planner.js"
import type { PlanItem } from "../run-plan.js"

export interface FeatureOptions {
  views?: boolean
  api?: boolean
}

export function makeFeaturePlan(entity: string, fields?: string, options: FeatureOptions = {}): PlanItem[] {
  const entityPascal = toPascalCase(entity)
  const entitySnake = snakeCase(entity)
  const entityPlural = snakeCase(pluralize(entity))
  const table = entityPlural
  const parsed = parseFields(fields)

  const useApi = options.api === true
  const useViews = options.views !== false && !useApi

  const plan: PlanItem[] = [
    {
      step: 1,
      type: "migration",
      params: { entitySnake, entityPlural, table, fields: parsed },
      optional: false,
    },
    {
      step: 2,
      type: "model",
      params: { entityPascal, fields: parsed },
      optional: false,
    },
    {
      step: 3,
      type: useApi ? "apiController" : "controller",
      params: { entityPascal, auth: useApi },
      optional: false,
    },
    {
      step: 4,
      type: "request",
      params: { entityPascal, fields: parsed },
      optional: false,
    },
    {
      step: 5,
      type: useApi ? "apiRoute" : "route",
      params: { entityPascal, entityPlural, auth: useApi },
      optional: false,
    },
  ]

  let step = 6

  if (useViews) {
    plan.push({
      step: step++,
      type: "views",
      params: { entityPascal, entitySnake, entityPlural, fields: parsed },
      optional: false,
    })
  }

  if (useApi) {
    plan.push({
      step,
      type: "apiTest",
      params: { entityPascal, entitySnake, entityPlural, table, fields: parsed, auth: false },
      optional: false,
    })
  } else {
    plan.push({
      step,
      type: "test",
      params: { entityPascal, entitySnake, entityPlural, table, fields: parsed },
      optional: false,
    })
  }

  return plan
}
