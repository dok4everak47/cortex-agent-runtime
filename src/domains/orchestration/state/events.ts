import { spawn } from "child_process"
import { constants } from "fs"
import { access, appendFile, mkdir } from "fs/promises"
import { join } from "path"

// 追加事件到 .htask/events.jsonl (JSON Lines), 与 htask 完全同格式: { ts, ...event }。
// 钩子: .htask/hooks/on-<type> 存在且可执行时 spawn, 参数=事件 JSON, cwd=项目根; 失败仅 warn。
export async function emitEvent(cwd: string, event: Record<string, unknown>): Promise<void> {
  const record: { ts: string } & Record<string, unknown> = { ts: new Date().toISOString(), ...event }
  try {
    await mkdir(join(cwd, ".htask"), { recursive: true })
    await appendFile(join(cwd, ".htask", "events.jsonl"), JSON.stringify(record) + "\n")
  } catch (err) {
    console.warn(`⚠️ 写入事件失败: ${err instanceof Error ? err.message : String(err)}`)
  }
  const hook = join(cwd, ".htask", "hooks", `on-${record.type}`)
  try {
    await access(hook, constants.X_OK)
  } catch {
    return
  }
  try {
    const child = spawn(hook, [JSON.stringify(record)], { cwd, stdio: "ignore" })
    child.on("error", (err) => console.warn(`⚠️ hook ${hook} 执行失败: ${err.message}`))
    child.on("exit", (code) => {
      if (code !== 0) console.warn(`⚠️ hook ${hook} 退出码 ${code}`)
    })
  } catch (err) {
    console.warn(`⚠️ hook 执行失败: ${err instanceof Error ? err.message : String(err)}`)
  }
}
