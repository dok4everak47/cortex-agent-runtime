export type PlannedAction =
  | "create_feature"
  | "create_crud"
  | "create_api"
  | "add_relation"
  | "add_policy"
  | "add_test"
  | "enhance"
  | "fix_bug"
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
  target?: string
  options: {
    views?: boolean
    api?: boolean
    auth?: boolean
    relation?: Relation
  }
  confidence: number
  raw: string
  summary?: string
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
