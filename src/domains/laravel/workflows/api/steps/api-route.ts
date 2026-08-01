import { existsSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import type { StepOutput } from "../../run-plan.js"

function ensureNewline(content: string): string {
  return content.endsWith("\n") ? content : content + "\n"
}

function buildApiResourceLine(entityPascal: string, entityPlural: string): string {
  return `Route::apiResource('${entityPlural}', ${entityPascal}Controller::class);`
}

function addToSanctumGroup(content: string, routeLine: string): string {
  const open = /Route::middleware\('auth:sanctum'\)->group\(function\s*\(\)\s*\{\s*\n/
  if (open.test(content)) {
    return content.replace(open, (m) => `${m}${routeLine}\n`)
  }
  return ensureNewline(content) + `\nRoute::middleware('auth:sanctum')->group(function () {\n    ${routeLine}\n});\n`
}

export async function execute(params: Record<string, unknown>, projectPath: string): Promise<StepOutput> {
  const entityPascal = params.entityPascal as string
  const entityPlural = params.entityPlural as string
  const auth = params.auth === true

  const routeFile = join(projectPath, "routes", "api.php")
  if (!existsSync(routeFile)) {
    return { status: "failed", error: "No routes/api.php file found" }
  }

  let content = readFileSync(routeFile, "utf-8")
  const routeLine = buildApiResourceLine(entityPascal, entityPlural)

  if (!content.includes(`apiResource('${entityPlural}'`)) {
    const importLine = `use App\\Http\\Controllers\\${entityPascal}Controller;`
    if (!content.includes(`use App\\Http\\Controllers\\${entityPascal}Controller`)) {
      content = content.replace(/(^use\s.*;$)/m, `$1\n${importLine}`)
    }
    content = auth ? addToSanctumGroup(content, routeLine) : ensureNewline(content) + `${routeLine}\n`
    writeFileSync(routeFile, content)
  }

  return { status: "done", file: "routes/api.php" }
}
