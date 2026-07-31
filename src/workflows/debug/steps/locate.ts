import { existsSync } from "fs"
import { join } from "path"
import type { StepOutput } from "../../run-plan.js"

export function resolveFile(projectPath: string, hint: string | null | undefined): { file: string | null; note?: string } {
  if (!hint || !hint.trim()) {
    return { file: null, note: "No file path or class hint provided" }
  }
  const hintTrim = hint.trim()

  const asAbsolute = hintTrim.startsWith("/")
    ? hintTrim
    : join(projectPath, hintTrim)
  if (existsSync(asAbsolute) && asAbsolute.endsWith(".php")) {
    return { file: asAbsolute.replace(projectPath, "").replace(/^\/+/, "") }
  }

  if (/^[\w\\]+$/.test(hintTrim) && hintTrim.includes("\\")) {
    const rel = `${hintTrim.replace(/\\/g, "/")}.php`
    if (existsSync(join(projectPath, rel))) return { file: rel }
    const short = hintTrim.split("\\").pop() ?? ""
    const modelPath = join(projectPath, "app", "Models", `${short}.php`)
    if (existsSync(modelPath)) return { file: `app/Models/${short}.php` }
  }

  if (/^[\w.]+$/.test(hintTrim) && !hintTrim.includes("\\")) {
    const viewRel = `${hintTrim.replace(/\./g, "/")}.blade.php`
    const viewPath = join(projectPath, "resources", "views", viewRel)
    if (existsSync(viewPath)) return { file: `resources/views/${viewRel}` }
  }

  return { file: null, note: `Could not resolve '${hintTrim}' to a file in the project` }
}

export async function execute(params: Record<string, unknown>, projectPath: string): Promise<StepOutput> {
  const hint = params.hint as string | undefined
  const line = params.line as number | undefined
  const resolved = resolveFile(projectPath, hint)

  if (!resolved.file) {
    return { status: "skipped", note: resolved.note }
  }

  return { status: "done", file: resolved.file, line }
}
