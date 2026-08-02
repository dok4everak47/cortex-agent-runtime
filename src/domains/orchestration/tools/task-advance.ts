import { getConfig } from "../../../core/mcp.js"
import { failure, success } from "../../../core/tool-helper.js"
import { approvalDecision, loadApprovalPolicy } from "../state/approval.js"
import { transition } from "../state/state-machine.js"
import { doMerge } from "../state/task-merge.js"
import { currentTask, readTask, type TaskRecord } from "../state/task-store.js"

async function resolveTask(cwd: string, taskId?: string): Promise<TaskRecord | null> {
  if (taskId) return readTask(cwd, taskId)
  return currentTask(cwd)
}

function skipReason(task: TaskRecord): string {
  switch (task.status) {
    case "CREATED":
      return "未开始"
    case "PLANNING":
      return "规划中"
    case "IMPLEMENTING":
      return "等待实现完成"
    case "REVIEWING":
      return "等待审查完成"
    case "FAILED":
      return "任务失败, 需修复后重试"
    case "CANCELLED":
      return "任务已取消"
    default:
      return "状态不可自动推进"
  }
}

// taskAdvance: 对齐 htask cmdAdvance 完整推进链。
//  - MERGED → 幂等 no-op; VERIFYING 验证未全过 → BLOCKED failure
//  - VERIFYING + 审批 human → WAITING_HUMAN 提示 (不推进, 不报错)
//  - VERIFYING + 审批 auto (或无 plan 旧任务) → ACCEPTED → doMerge; ACCEPTED → doMerge
// doMerge 默认 push, noPush 可显式跳过; push 失败仅 warn 不导致任务失败。
export async function executeTaskAdvance(args: { taskId?: string; noPush?: boolean } = {}) {
  const toolName = "taskAdvance"
  try {
    const { projectPath } = getConfig()
    const noPush = args?.noPush === true
    const task = await resolveTask(projectPath, args?.taskId)
    if (!task) return failure(toolName, new Error("没有当前任务或任务不存在"))

    if (task.status === "MERGED") {
      return success(`⏸ ${task.id} 已是终态 (MERGED), 无操作 (幂等)`)
    }

    if (task.status === "VERIFYING") {
      const verify = Array.isArray(task.verify) ? task.verify : []
      if (!verify.every((r) => r.exitCode === 0)) {
        return failure(toolName, new Error(`${task.id} 验证未全过 (BLOCKED), 需修复后重试`))
      }
      // 审批策略闸门: 仅对有 plan 的任务生效; 无 plan (旧任务) 保持自动推进 (向后兼容)
      if (task.plan) {
        const policy = await loadApprovalPolicy(projectPath)
        const approval = approvalDecision({ risk: task.plan.risk ?? [], policy })
        if (approval === "human") {
          const risky = (task.plan.risk ?? []).length > 0
          const why = risky ? "高风险任务" : "低风险但策略需人工"
          return success(`⏸ ${task.id} 停在 VERIFYING (WAITING_HUMAN): ${why}, 请先 taskAccept`)
        }
      }
      await transition(projectPath, task.id, "ACCEPTED", "auto")
    }

    const cur = await readTask(projectPath, task.id)
    if (cur && cur.status === "ACCEPTED") {
      const res = await doMerge(projectPath, cur, { noPush, by: "auto" })
      const pushNote = res.committed ? "" : " (无代码改动, 仅归档)"
      return success(`✅ ${cur.id} → MERGED, 全链路自动完成${pushNote}${res.message ? ` · ${res.message}` : ""}`)
    }

    if (cur) {
      return success(`⏸ ${cur.id} 停在 ${cur.status}: ${skipReason(cur)}`)
    }
    return failure(toolName, new Error(`任务不存在: ${task.id}`))
  } catch (err) {
    return failure(toolName, err)
  }
}
