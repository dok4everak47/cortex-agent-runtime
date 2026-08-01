import { readFileSync, writeFileSync, existsSync } from "fs"
import { join } from "path"
import { runArtisan } from "../../../mcp.js"
import type { FieldDef, StepResult } from "../planner.js"

export async function execute(params: Record<string, unknown>, projectPath: string): Promise<StepResult> {
  const entityPascal = params.entityPascal as string
  const fields = params.fields as FieldDef[]

  const modelFile = join(projectPath, "app", "Models", `${entityPascal}.php`)
  if (!existsSync(modelFile)) {
    runArtisan(`make:model ${entityPascal}`)
  }

  if (!existsSync(modelFile)) {
    return { status: "failed", error: `Model file not found at app/Models/${entityPascal}.php` }
  }

  let content = readFileSync(modelFile, "utf-8")

  if (fields.length > 0) {
    if (content.includes("protected $fillable")) {
      const fillable = fields.map(f => `        '${f.name}'`).join(",\n")
      content = content.replace(
        /protected\s+\$fillable\s*=\s*\[([^\]]*)\]\s*;/,
        (_match: string, existing: string) => {
          const existingItems = existing.split(",").map((s: string) => s.trim().replace(/^'|'$/g, "")).filter(Boolean)
          const newItems = fields.filter(f => !existingItems.includes(f.name))
          if (newItems.length === 0) return `protected $fillable = [${existing}];`
          const merged = [...existingItems, ...newItems.map(f => f.name)]
          const mergedStr = merged.map(n => `        '${n}'`).join(",\n")
          return `protected $fillable = [\n${mergedStr},\n    ];`
        }
      )
    } else {
      const fillable = fields.map(f => `        '${f.name}'`).join(",\n")
      content = content.replace(
        /(class\s+\w+\s+extends\s+Model\s*\{)/,
        `$1\n    protected \$fillable = [\n${fillable},\n    ];`
      )
    }
  }

  const jsonFields = fields.filter(f => f.type === "json")
  if (jsonFields.length > 0) {
    const casts = jsonFields.map(f => `        '${f.name}' => 'array',`).join("\n")
    if (!content.includes("protected $casts")) {
      content = content.replace(
        /(protected\s+\$fillable\s*=\s*\[[^\]]*\]\s*;)/,
        `$1\n\n    protected \$casts = [\n${casts}\n    ];`
      )
    }
  }

  writeFileSync(modelFile, content)

  return { status: "done", file: `app/Models/${entityPascal}.php` }
}
