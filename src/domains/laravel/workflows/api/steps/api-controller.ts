import { existsSync } from "fs"
import { join } from "path"
import { runArtisan } from "../../../mcp.js"
import type { StepOutput } from "../../run-plan.js"

export async function execute(params: Record<string, unknown>, projectPath: string): Promise<StepOutput> {
  const entityPascal = params.entityPascal as string

  const controllerFile = join(projectPath, "app", "Http", "Controllers", `${entityPascal}Controller.php`)
  if (!existsSync(controllerFile)) {
    runArtisan(`make:controller ${entityPascal}Controller --api --model=${entityPascal}`)
  }

  if (!existsSync(controllerFile)) {
    return { status: "failed", error: "API controller file not found" }
  }

  return { status: "done", file: `app/Http/Controllers/${entityPascal}Controller.php` }
}
