export type PlannedAction =
  | "create_feature"
  | "create_crud"
  | "create_api"
  | "add_relation"
  | "add_policy"
  | "add_test"
  | "debug"

export type RelationType = "hasMany" | "belongsTo" | "belongsToMany" | "hasOne"

export type Relation = {
  type: RelationType
  target: string
  on: string
}

export type Intent = {
  action: PlannedAction
  entity: string
  table?: string
  fields?: string
  options: {
    views?: boolean
    api?: boolean
    auth?: boolean
    relation?: Relation
  }
  confidence: number
  raw: string
}

export type PlanStep = {
  step: number
  type: string
  action: PlannedAction
  params: Record<string, unknown>
  optional?: boolean
  dependsOn?: number[]
}

export type Plan = {
  intent: Intent
  steps: PlanStep[]
  summary: string
}
