import { handleIntentPlanner } from "../src/domains/laravel/planner/index.js"

async function main() {
  const r = await handleIntentPlanner({ request: "增强博客搜索", dryRun: false, confirmed: true })
  const p = JSON.parse(r.content[0].text)
  console.log("mode:", p.mode)
  console.log("executed.workflow:", p.executed?.workflow ?? "(none)")
  console.log("executed.status:", p.executed?.status ?? "(none)")
  console.log("runId:", p.executed?.runId ?? "(none)")
  const s = p.executed?.steps ?? []
  console.log("steps:", s.map((x: { name: string; status: string }) => `${x.name}:${x.status}`).join(", "))
}

main().catch((e) => {
  console.error("ERR", e)
  process.exit(1)
})
