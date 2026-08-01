import { readFileSync, writeFileSync, existsSync } from "fs"
import { join } from "path"
import { runArtisan } from "../../../mcp.js"
import type { FieldDef, StepResult } from "../planner.js"

function getValidationRule(field: FieldDef): string {
  const { name, type } = field
  const relatedTable = name.endsWith("_id") ? name.replace(/_id$/, "s") : name.replace(/_id$/, "") + "s"
  switch (type) {
    case "string": return `            '${name}' => 'required|string|max:255',`
    case "text": return `            '${name}' => 'required|string',`
    case "integer": return `            '${name}' => 'required|integer',`
    case "boolean": return `            '${name}' => 'boolean',`
    case "foreignId": return `            '${name}' => 'required|integer|exists:${relatedTable},id',`
    case "json": return `            '${name}' => 'nullable|json',`
    case "datetime": return `            '${name}' => 'nullable|date',`
    default: return `            '${name}' => 'required|string|max:255',`
  }
}

export async function execute(params: Record<string, unknown>, projectPath: string): Promise<StepResult> {
  const entityPascal = params.entityPascal as string
  const fields = params.fields as FieldDef[]

  const requestFile = join(projectPath, "app", "Http", "Requests", `Store${entityPascal}Request.php`)
  if (!existsSync(requestFile)) {
    runArtisan(`make:request Store${entityPascal}Request`)
  }

  if (!existsSync(requestFile)) {
    return { status: "failed", error: "Form request file not found" }
  }

  let content = readFileSync(requestFile, "utf-8")
  content = content.replace(/return\s+(false|true)\s*;/, "return true;")

  if (fields.length > 0) {
    const rules = fields.map(f => getValidationRule(f)).join("\n")
    content = content.replace(
      /return\s*\[[\s\S]*?\];/,
      `return [\n${rules}\n        ];`
    )
  }

  writeFileSync(requestFile, content)

  return { status: "done", file: `app/Http/Requests/Store${entityPascal}Request.php` }
}
