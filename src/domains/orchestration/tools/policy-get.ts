import { join } from "path"
import { getConfig } from "../../../core/mcp.js"
import { success, failure } from "../../../core/tool-helper.js"
import { loadApprovalPolicy } from "../state/approval.js"

export async function executePolicyGet() {
  try {
    const { projectPath } = getConfig()
    const policy = await loadApprovalPolicy(projectPath)
    const human = (r: boolean): string => (r ? "需人工 accept" : "advance 自动过闸")
    const lines = [
      `审批策略 (来源: ${policy.source})`,
      `  high_risk: ${policy.rules.high_risk} → 高风险 (有 risk): ${human(policy.rules.high_risk)}`,
      `  low_risk: ${policy.rules.low_risk} → 低风险 (无 risk): ${human(policy.rules.low_risk)}`,
      `配置路径: ${join(projectPath, ".htask", "approval.yaml")}`,
      `说明: htask advance 时判定; accept 人工显式确认始终有效。`,
    ]
    return success(lines.join("\n"))
  } catch (err) {
    return failure("policyGet", err)
  }
}
