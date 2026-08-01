import { parseFields, pluralize, snakeCase, toPascalCase } from "../crud/planner.js"
import type { PlanItem } from "../run-plan.js"

export function makeApiPlan(entity: string, fields?: string, auth = false): PlanItem[] {
  const entityPascal = toPascalCase(entity)
  const entitySnake = snakeCase(entity)
  const entityPlural = snakeCase(pluralize(entity))
  const table = entityPlural
  const parsed = parseFields(fields)

  return [
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
      type: "apiController",
      params: { entityPascal },
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
      type: "apiRoute",
      params: { entityPascal, entityPlural, auth },
      optional: false,
    },
    {
      step: 6,
      type: "test",
      params: { entityPascal, entitySnake, entityPlural, table, fields: parsed, auth },
      optional: false,
    },
  ]
}
