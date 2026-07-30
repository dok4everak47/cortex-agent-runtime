import { readFileSync, writeFileSync, existsSync } from "fs"
import { join } from "path"
import type { StepResult } from "../planner.js"

function ensureNewline(content: string): string {
  return content.endsWith("\n") ? content : content + "\n"
}

export async function execute(params: Record<string, unknown>, projectPath: string): Promise<StepResult> {
  const entityPascal = params.entityPascal as string
  const entityPlural = params.entityPlural as string

  let routeFile = join(projectPath, "routes", "web.php")
  if (!existsSync(routeFile)) {
    routeFile = join(projectPath, "routes", "api.php")
  }

  if (!existsSync(routeFile)) {
    return { status: "failed", error: "No routes file found (routes/web.php or routes/api.php)" }
  }

  let content = readFileSync(routeFile, "utf-8")
  const importLine = `use App\\Http\\Controllers\\${entityPascal}Controller;`
  const routeLine = `Route::resource('${entityPlural}', ${entityPascal}Controller::class);`

  if (!content.includes(`Route::resource('${entityPlural}'`)) {
    if (!content.includes(`use App\\Http\\Controllers\\${entityPascal}Controller`)) {
      content = content.replace(/(^use\s.*;$)/m, `$1\n${importLine}`)
    }
    content = ensureNewline(content) + `${routeLine}\n`
  }

  writeFileSync(routeFile, content)

  return { status: "done", file: routeFile.replace(projectPath, "").replace(/^\//, "") }
}
