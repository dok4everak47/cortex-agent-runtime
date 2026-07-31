import type { Intent, PlannedAction, Relation, RelationType } from "./plan-schema.js"

const ACTION_PATTERNS: Array<{ pattern: RegExp; action: PlannedAction; confidence: number }> = [
  { pattern: /(增加|添加|创建|新建|加|create|add|make)\S*\s*(.{0,30}?)(功能|feature)/i, action: "create_feature", confidence: 0.8 },
  { pattern: /(crud|增删改查)/i, action: "create_crud", confidence: 0.9 },
  { pattern: /(api|接口|rest)/i, action: "create_api", confidence: 0.85 },
  { pattern: /(关系|关联|多对多|一对多|多对一|一对一带|belongs)/i, action: "add_relation", confidence: 0.85 },
  { pattern: /(权限|策略|policy|authorize)/i, action: "add_policy", confidence: 0.8 },
  { pattern: /(测试|test)/i, action: "add_test", confidence: 0.7 },
  { pattern: /(报错|错误|异常|debug|修复|修一下|解决)/i, action: "debug", confidence: 0.8 },
]

const ACTION_KEYWORDS: Record<PlannedAction, RegExp> = {
  create_feature: /功能|feature/i,
  create_crud: /crud|增删改查/i,
  create_api: /api|接口|rest/i,
  add_relation: /关系|关联|多对多|一对多|多对一|belongs/i,
  add_policy: /权限|策略|policy|authorize/i,
  add_test: /测试|test/i,
  debug: /报错|错误|异常|debug|修复|修一下|解决/i,
}

const ENTITY_MAP: Record<string, string> = {
  "评论": "Comment",
  "文章": "Post",
  "帖子": "Post",
  "用户": "User",
  "标签": "Tag",
  "分类": "Category",
  "点赞": "Reaction",
  "作者": "Author",
  "角色": "Role",
  "权限": "Permission",
  "订单": "Order",
  "产品": "Product",
  "商品": "Product",
  "留言": "Message",
  "回复": "Reply",
  "博客": "Blog",
}

const NON_ENTITY_ENGLISH = new Set(["rest", "api", "crud", "and", "or", "the", "for"])

const FIELD_INFER_MAP: Record<string, string> = {
  "标题": "title:string",
  "内容": "content:text",
  "名称": "name:string",
  "名字": "name:string",
  "描述": "description:text",
  "邮箱": "email:string",
  "密码": "password:string",
  "数量": "quantity:integer",
  "价格": "price:integer",
  "状态": "status:string",
}

interface EntityRef {
  name: string
  index: number
}

function collectEntities(input: string): EntityRef[] {
  const result: EntityRef[] = []
  const seen = new Set<string>()

  const enRe = /\b[A-Z][A-Za-z]*\b/g
  let m: RegExpExecArray | null
  while ((m = enRe.exec(input)) !== null) {
    if (NON_ENTITY_ENGLISH.has(m[0].toLowerCase())) continue
    const key = `en:${m[0].toLowerCase()}`
    if (!seen.has(key)) {
      result.push({ name: m[0], index: m.index })
      seen.add(key)
    }
  }

  for (const [zh, en] of Object.entries(ENTITY_MAP)) {
    let idx = input.indexOf(zh)
    while (idx !== -1) {
      const key = `zh:${en}`
      if (!seen.has(key)) {
        result.push({ name: en, index: idx })
        seen.add(key)
      }
      idx = input.indexOf(zh, idx + zh.length)
    }
  }

  return result.sort((a, b) => a.index - b.index)
}

function actionTriggerIndex(input: string, action: PlannedAction): number {
  const re = ACTION_KEYWORDS[action]
  const m = input.match(re)
  return m ? m.index ?? -1 : -1
}

function pickEntity(entities: EntityRef[], input: string, action: PlannedAction): string {
  if (entities.length === 0) return ""
  if (entities.length === 1) return entities[0].name

  const kw = actionTriggerIndex(input, action)
  if (kw !== -1) {
    const before = entities.filter((e) => e.index < kw)
    if (before.length > 0) return before[before.length - 1].name
  }
  return entities[entities.length - 1].name
}

function extractRelation(input: string, entities: EntityRef[]): Relation | undefined {
  if (entities.length < 2) return undefined

  let type: RelationType = "hasMany"
  if (/多对多|belongsToMany|belongs to many/i.test(input)) type = "belongsToMany"
  else if (/多对一|belongsTo\b|belongs to\b/i.test(input)) type = "belongsTo"
  else if (/一对多|hasMany|has many/i.test(input)) type = "hasMany"
  else if (/一对一|hasOne|has one/i.test(input)) type = "hasOne"

  return { type, target: entities[1].name, on: entities[0].name }
}

function extractFields(input: string): string | undefined {
  const explicit = input.match(
    /\b([a-z][a-zA-Z0-9_]*:[a-zA-Z0-9_]+(?:\s*,\s*[a-z][a-zA-Z0-9_]*:[a-zA-Z0-9_]+)*)/i,
  )
  if (explicit) return explicit[1].replace(/\s+/g, "")

  const inferred: string[] = []
  for (const [zh, def] of Object.entries(FIELD_INFER_MAP)) {
    if (input.includes(zh)) inferred.push(def)
  }
  const seen = new Set<string>()
  const unique = inferred.filter((def) => {
    const name = def.split(":")[0]
    if (seen.has(name)) return false
    seen.add(name)
    return true
  })
  return unique.length > 0 ? unique.join(",") : undefined
}

export function parseIntent(input: string): Intent {
  const raw = input.trim()

  let action: PlannedAction = "create_feature"
  let baseConfidence = 0.2
  for (const { pattern, action: a, confidence } of ACTION_PATTERNS) {
    if (pattern.test(raw)) {
      action = a
      baseConfidence = confidence
      break
    }
  }

  const entities = collectEntities(raw)
  const fields = extractFields(raw)
  const relation = action === "add_relation" ? extractRelation(raw, entities) : undefined
  const entity = relation ? relation.on : pickEntity(entities, raw, action)

  const options: Intent["options"] = {}
  if (action === "create_api") {
    options.api = true
    options.views = false
  }
  if (action === "create_feature" || action === "create_crud") {
    options.api = false
    options.views = action === "create_feature"
  }
  if (/(登录|认证|auth|鉴权)/i.test(raw)) options.auth = true
  if (relation) options.relation = relation

  let confidence = baseConfidence
  if (entity) confidence += 0.1
  if (fields) confidence += 0.05
  if (relation) confidence += 0.05
  confidence = Math.min(0.99, Math.max(0.1, Math.round(confidence * 100) / 100))

  return {
    action,
    entity,
    fields,
    options,
    confidence,
    raw,
  }
}
