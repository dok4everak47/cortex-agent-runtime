import { existsSync } from "fs"
import { join } from "path"
import { runArtisan } from "../../../mcp.js"
import type { StepResult } from "../planner.js"

export async function execute(params: Record<string, unknown>, projectPath: string): Promise<StepResult> {
  const entityPascal = params.entityPascal as string

  const controllerFile = join(projectPath, "app", "Http", "Controllers", `${entityPascal}Controller.php`)
  if (!existsSync(controllerFile)) {
    runArtisan(`make:controller ${entityPascal}Controller --resource --model=${entityPascal}`)
  }

  if (!existsSync(controllerFile)) {
    return { status: "failed", error: "Controller file not found" }
  }

  return { status: "done", file: `app/Http/Controllers/${entityPascal}Controller.php` }
}
