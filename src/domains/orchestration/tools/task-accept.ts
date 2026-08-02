import { getConfig } from "../../../core/mcp.js"
import { failure, success } from "../../../core/tool-helper.js"
import { emitEvent } from "../state/events.js"
import { transition } from "../state/state-machine.js"
import { currentTask, readTask, type TaskRecord } from "../state/task-store.js"

async function resolveTask(cwd: string, taskId?: string): Promise<TaskRecord | null> {
  if (taskId) return readTask(cwd, taskId)
  return currentTask(cwd)
}

// taskAccept: VERIFYING + verify 全过 → ACCEPTED (by=human) + events.jsonl 事件。
// 状态不对 / 验证未全过 / 任务不存在 → failure 明确报错。
export async function executeTaskAccept(args: { taskId?: string } = {}) {
  const toolName = "taskAccept"
  try {
    const { projectPath } = getConfig()
    const task = await resolveTask(projectPath, args?.taskId)
    if (!task) return failure(toolName, new Error("没有当前任务或任务不存在"))
    if (task.status !== "VERIFYING") {
      return failure(toolName, new Error(`拒绝: 任务状态是 ${task.status}, 只有 VERIFYING 可 accept`))
    }
    const verify = Array.isArray(task.verify) ? task.verify : []
    if (!verify.every((r) => r.exitCode === 0)) {
      return failure(toolName, new Error("拒绝: 验证未全过, 任务应处于 FAILED, 需人工介入"))
    }
    await transition(projectPath, task.id, "ACCEPTED", "human")
    await emitEvent(projectPath, { type: "task.waiting_human", taskId: task.id, reason: "merge" })
    return success(`✅ ${task.id} → ACCEPTED (by=human), 下一步: taskAdvance 或 htask merge`)
  } catch (err) {
    return failure(toolName, err)
  }
}
