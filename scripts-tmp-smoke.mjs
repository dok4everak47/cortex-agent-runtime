import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const projectPath = process.argv[2]
const server = spawn("node", ["dist/index.js"], {
  cwd: "/Users/dok4ever/Project/cortex-agent-runtime",
  env: { ...process.env, CORTEX_PROJECT_PATH: projectPath },
  stdio: ["pipe", "pipe", "pipe"],
})

let buf = ""
let id = 0
const pending = new Map()

function send(method, params) {
  const msg = { jsonrpc: "2.0", id: ++id, method, params }
  server.stdin.write(JSON.stringify(msg) + "\n")
  return new Promise((resolve) => pending.set(id, resolve))
}

server.stdout.on("data", (d) => {
  buf += d.toString()
  let idx
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx)
    buf = buf.slice(idx + 1)
    if (!line.trim()) continue
    const msg = JSON.parse(line)
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    }
  }
})

await new Promise((r) => setTimeout(r, 300))
const init = await send("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "smoke", version: "0.0.1" },
})
console.log("== initialize:", init.result?.serverInfo?.name ?? "N/A")

const list = await send("tools/list", {})
const names = list.result?.tools?.map((t) => t.name) ?? []
console.log("== tools:", names.join(", "))
console.log("== has taskAccept:", names.includes("taskAccept"), "| has taskAdvance:", names.includes("taskAdvance"))

const accept = await send("tools/call", { name: "taskAccept", arguments: { taskId: "task-smoke" } })
console.log("== taskAccept:", JSON.stringify(accept.result))

const advance = await send("tools/call", { name: "taskAdvance", arguments: { taskId: "task-smoke" } })
console.log("== taskAdvance:", JSON.stringify(advance.result))

const status = JSON.parse(readFileSync(join(projectPath, ".htask", "tasks", "task-smoke.json"), "utf8"))
console.log("== final status:", status.status, "| history tail:", JSON.stringify(status.history.at(-1)))

const log = await send("tools/call", { name: "taskAdvance", arguments: { taskId: "task-smoke" } })
console.log("== taskAdvance again (idempotent):", JSON.stringify(log.result))

const events = readFileSync(join(projectPath, ".htask", "events.jsonl"), "utf8").trim().split("\n")
console.log("== events.jsonl:", events.join(" || "))
server.kill()
process.exit(0)
