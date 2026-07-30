import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs"
import { join } from "path"
import { runArtisan } from "../../../mcp.js"
import type { FieldDef, StepResult } from "../planner.js"

function findMigrationFile(projectPath: string, table: string): string | null {
  const dir = join(projectPath, "database", "migrations")
  if (!existsSync(dir)) return null
  const pattern = `create_${table}_table`
  const files = readdirSync(dir).filter(f => f.includes(pattern))
  if (files.length === 0) return null
  files.sort().reverse()
  return join(dir, files[0])
}

function hasExistingMigration(projectPath: string, table: string): boolean {
  const dir = join(projectPath, "database", "migrations")
  if (!existsSync(dir)) return false
  return readdirSync(dir).some(f => {
    try {
      const content = readFileSync(join(dir, f), "utf-8")
      return content.includes(`Schema::create('${table}'`)
    } catch { return false }
  })
}

function getMigrationColumn(field: FieldDef): string {
  const { name, type } = field
  switch (type) {
    case "string": return `$table->string('${name}');`
    case "text": return `$table->text('${name}');`
    case "integer": return `$table->integer('${name}');`
    case "boolean": return `$table->boolean('${name}');`
    case "foreignId": return `$table->foreignId('${name}')->constrained();`
    case "json": return `$table->json('${name}');`
    case "datetime": return `$table->datetime('${name}');`
    default: return `$table->string('${name}');`
  }
}

export async function execute(params: Record<string, unknown>, projectPath: string): Promise<StepResult> {
  const table = params.table as string
  const entityPlural = params.entityPlural as string
  const fields = params.fields as FieldDef[]

  if (hasExistingMigration(projectPath, table)) {
    return { status: "skipped", error: `Migration for table '${table}' already exists` }
  }

  const output = runArtisan(`make:migration create_${entityPlural}_table --create=${table}`)
  const migrationFile = findMigrationFile(projectPath, table)

  if (!migrationFile) {
    const msg = `Could not find migration file for table '${table}'`
    return { status: "failed", error: output ? `${msg}: ${output.substring(0, 200)}` : msg }
  }

  let content = readFileSync(migrationFile, "utf-8")
  const columnDefs = fields.map(f => `            ${getMigrationColumn(f)}`).join("\n")
  if (columnDefs) {
    content = content.replace(/(\$table->id\(\);)/, `$1\n${columnDefs}`)
  }
  writeFileSync(migrationFile, content)

  return { status: "done", file: migrationFile.replace(projectPath, "").replace(/^\//, "") }
}
