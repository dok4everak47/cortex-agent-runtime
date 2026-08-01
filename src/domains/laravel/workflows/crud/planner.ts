export interface FieldDef {
  name: string
  type: string
}

export type PlanItem = {
  step: number
  type: "migration" | "model" | "controller" | "request" | "route" | "test"
  params: Record<string, unknown>
  optional: boolean
}

export type StepResult = {
  status: "done" | "skipped" | "failed"
  file?: string
  error?: string
  testOutput?: string
}

export function parseFields(input: string | undefined): FieldDef[] {
  if (!input || !input.trim()) return []
  return input.split(",").map(pair => {
    const [name, type = "string"] = pair.trim().split(":")
    return { name, type }
  })
}

export function pluralize(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith("s") || lower.endsWith("x") || lower.endsWith("ch") || lower.endsWith("sh")) return name + "es"
  if (lower.endsWith("y") && !["a", "e", "i", "o", "u"].includes(lower[lower.length - 2])) return name.slice(0, -1) + "ies"
  return name + "s"
}

export function snakeCase(name: string): string {
  return name.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")
}

export function toPascalCase(name: string): string {
  if (!name) return name
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function makePlan(entity: string, _fields?: string, _table?: string): PlanItem[] {
  const entityPascal = toPascalCase(entity)
  const entitySnake = snakeCase(entity)
  const entityPlural = snakeCase(pluralize(entity))
  const table = _table ?? entityPlural
  const fields = parseFields(_fields)

  return [
    {
      step: 1,
      type: "migration",
      params: { entitySnake, entityPlural, table, fields },
      optional: false,
    },
    {
      step: 2,
      type: "model",
      params: { entityPascal, fields },
      optional: false,
    },
    {
      step: 3,
      type: "controller",
      params: { entityPascal },
      optional: false,
    },
    {
      step: 4,
      type: "request",
      params: { entityPascal, fields },
      optional: false,
    },
    {
      step: 5,
      type: "route",
      params: { entityPascal, entityPlural },
      optional: false,
    },
    {
      step: 6,
      type: "test",
      params: { entityPascal, entitySnake, entityPlural, table, fields },
      optional: false,
    },
  ]
}
