import { readFile } from "fs/promises"
import { join } from "path"

export interface ApprovalRules {
  high_risk: boolean
  low_risk: boolean
}

export interface ApprovalPolicy {
  rules: ApprovalRules
  source: "default" | "file"
}

const DEFAULTS: ApprovalRules = { high_risk: true, low_risk: true }

// 解析 YAML 子集: 支持 "key: value" 与 "rules:" 段下的缩进项; 值支持 true/false/数字/字符串。
// 支持整行注释 (行首 #) 与行内注释 (值后带空格的 # 起为注释)。
export function parseApprovalYaml(text: string): Partial<ApprovalRules> {
  const rules: Record<string, unknown> = {}
  let inRules = false
  for (const raw of String(text).split("\n")) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    if (line.startsWith("rules:")) {
      const rest = line.slice("rules:".length).trim()
      if (rest && rest !== "{}") throw new Error(`无效的 rules 行: ${line}`)
      inRules = true
      continue
    }
    if (!inRules) continue
    const m = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/)
    if (m) rules[m[1]] = parseYamlScalar(m[2])
  }
  return rules as Partial<ApprovalRules>
}

function parseYamlScalar(v: string): unknown {
  // 行内注释: 值后带空格的 # 起为注释, 如 "false # 自动过闸" → false
  const s = String(v).replace(/\s+#.*$/, "").trim()
  if (s === "true") return true
  if (s === "false") return false
  const n = Number(s)
  if (s !== "" && Number.isFinite(n)) return n
  return s.replace(/^["']|["']$/g, "")
}

// 不存在或解析失败 → 默认全部需人工 (保守, 向后兼容)。
export async function loadApprovalPolicy(cwd: string): Promise<ApprovalPolicy> {
  let text: string
  try {
    text = await readFile(join(cwd, ".htask", "approval.yaml"), "utf8")
  } catch {
    return { rules: { ...DEFAULTS }, source: "default" }
  }
  try {
    const parsed = parseApprovalYaml(text)
    return { rules: { ...DEFAULTS, ...parsed }, source: "file" }
  } catch (err) {
    console.warn(
      `⚠️ 解析 approval.yaml 失败, 使用默认 (全部人工): ${err instanceof Error ? err.message : String(err)}`
    )
    return { rules: { ...DEFAULTS }, source: "default" }
  }
}

// 判定单任务/单 plan 审批级别: risk 非空 → high_risk 规则; 空 → low_risk 规则
export function approvalDecision({
  risk = [],
  policy,
}: {
  risk?: string[]
  policy: ApprovalPolicy
}): "human" | "auto" {
  const rule = risk.length > 0 ? policy.rules.high_risk : policy.rules.low_risk
  return rule ? "human" : "auto"
}
