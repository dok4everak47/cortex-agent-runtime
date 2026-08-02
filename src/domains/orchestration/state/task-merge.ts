import { spawnSync } from "child_process"
import { getLogger } from "../../../core/mcp.js"
import { emitEvent } from "./events.js"
import { transition } from "./state-machine.js"
import type { TaskRecord } from "./task-store.js"

// 内置保护: merge/advance 提交时排除的运行产物 (与 htask 一致, 不依赖项目 .gitignore)
export const MERGE_EXCLUDE = ["REPORT.md", "REVIEW.md", ".htask"]

export interface MergeResult {
  ok: boolean
  committed: boolean
  message: string
}

function git(args: string[], cwd: string): { status: number; stdout: string; stderr: string } {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8" })
  return { status: r.status ?? -1, stdout: (r.stdout ?? "").toString(), stderr: (r.stderr ?? "").toString() }
}

// 在 git add 后、commit 前取消暂存内置保护文件 (仅排除, 不删除工作区文件)。
// git reset 不存在的文件也会 exit 0 (no-op), 无需检查存在性。
function unstageExcluded(cwd: string): void {
  for (const f of MERGE_EXCLUDE) {
    const r = git(["reset", "--", f], cwd)
    if (r.status !== 0) getLogger().warn(`git reset ${f} 失败 (已忽略): ${r.stderr.trim()}`)
  }
}

// git add/commit/push + transition MERGED, 对齐 htask doMerge。
// commit message = 任务 title; REPORT.md/REVIEW.md/.htask 不进入 commit;
// "nothing to commit" 优雅归档不失败 (任务仍 MERGED); push 失败仅 warn 不阻断。
export async function doMerge(
  cwd: string,
  task: TaskRecord,
  { noPush = false, by = "auto" }: { noPush?: boolean; by?: string } = {}
): Promise<MergeResult> {
  const add = git(["add", "-A"], cwd)
  if (add.status !== 0) {
    throw new Error(`git add 失败 (状态不变): ${add.stderr || add.stdout}`)
  }
  unstageExcluded(cwd)

  const commit = git(["commit", "-m", String(task.title), "--no-verify"], cwd)
  let committed = true
  if (commit.status !== 0) {
    const detail = (commit.stderr || commit.stdout || "").trim()
    if (/nothing to commit|no changes added to commit|nothing added to commit/i.test(detail)) {
      committed = false
      getLogger().warn("无代码改动 (工作树 clean), 仅归档任务状态")
    } else {
      throw new Error(`git commit 失败 (状态不变): ${detail}`)
    }
  }

  await transition(cwd, task.id, "MERGED", by)
  await emitEvent(cwd, { type: "task.completed", taskId: task.id, status: "MERGED" })

  if (noPush) {
    return { ok: true, committed, message: "跳过 git push (noPush)" }
  }
  const push = git(["push"], cwd)
  if (push.status !== 0) {
    const detail = (push.stderr || push.stdout || "").trim()
    getLogger().warn(`git push 失败 (任务已 MERGED): ${detail}`)
    return { ok: true, committed, message: "git push 失败 (任务已 MERGED, 已告警)" }
  }
  return { ok: true, committed, message: "git commit + push 成功" }
}
