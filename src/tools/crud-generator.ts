import { runArtisan, getConfig, getLogger } from "../mcp.js"
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs"
import { join } from "path"

const logger = getLogger()

interface FieldDef {
  name: string
  type: string
}

interface StepResult {
  step: number
  action: string
  status: "done" | "skipped" | "failed"
  file?: string
  error?: string
}

function parseFields(input: string | undefined): FieldDef[] {
  if (!input || !input.trim()) return []
  return input.split(",").map(pair => {
    const [name, type = "string"] = pair.trim().split(":")
    return { name, type }
  })
}

function pluralize(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith("s") || lower.endsWith("x") || lower.endsWith("ch") || lower.endsWith("sh")) return name + "es"
  if (lower.endsWith("y") && !["a", "e", "i", "o", "u"].includes(lower[lower.length - 2])) return name.slice(0, -1) + "ies"
  return name + "s"
}

function snakeCase(name: string): string {
  return name.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")
}

function toPascalCase(name: string): string {
  if (!name) return name
  return name.charAt(0).toUpperCase() + name.slice(1)
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

function getValidationRule(field: FieldDef): string {
  const { name, type } = field
  const relatedTable = name.endsWith("_id") ? name.replace(/_id$/, "s") : pluralize(name.replace(/_id$/, ""))
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

function getTableColumnsFromMigrations(projectPath: string, table: string): string[] {
  const dir = join(projectPath, "database", "migrations")
  if (!existsSync(dir)) return []
  const cols: string[] = []
  for (const f of readdirSync(dir)) {
    try {
      const content = readFileSync(join(dir, f), "utf-8")
      if (!content.includes(`Schema::create('${table}'`) && !content.includes(`Schema::table('${table}'`)) continue
      const lines = content.split("\n")
      for (const line of lines) {
        const m = line.match(/\$table->\w+\('(\w+)'\)/)
        if (m) cols.push(m[1])
      }
    } catch { continue }
  }
  return [...new Set(cols)]
}

function ensureNewline(content: string): string {
  return content.endsWith("\n") ? content : content + "\n"
}

function getTestValue(field: FieldDef): string {
  switch (field.type) {
    case "integer": return "1"
    case "boolean": return "true"
    case "text": return `'Test ${field.name} content'`
    case "json": return `['key' => 'value']`
    case "datetime": return "now()->toDateTimeString()"
    default: return `'Test ${field.name}'`
  }
}

function generateTestContent(entityPascal: string, entitySnake: string, entityPlural: string, fields: FieldDef[], existingColumns: string[]): string {
  const usableFields = existingColumns.length > 0
    ? fields.filter(f => existingColumns.includes(f.name))
    : fields
  const sampleData = usableFields.length > 0
    ? usableFields.map(f => `            '${f.name}' => ${getTestValue(f)}`).join(",\n")
    : `            'name' => 'Test ${entitySnake}'`

  return `<?php

namespace Tests\\Feature;

use App\\Models\\${entityPascal};
use Illuminate\\Foundation\\Testing\\RefreshDatabase;
use Tests\\TestCase;

class ${entityPascal}Test extends TestCase
{
    use RefreshDatabase;

    public function test_can_index_${entityPlural}(): void
    {
        $response = $this->get(route('${entityPlural}.index'));

        $response->assertOk();
    }

    public function test_can_store_${entitySnake}(): void
    {
        $response = $this->post(route('${entityPlural}.store'), [
${sampleData}
        ]);

        $this->assertTrue(in_array($response->getStatusCode(), [200, 201, 302]));
    }

    public function test_can_show_${entitySnake}(): void
    {
        $${entitySnake} = ${entityPascal}::create([
${sampleData}
        ]);

        $response = $this->get(route('${entityPlural}.show', $${entitySnake}));

        $response->assertOk();
    }

    public function test_can_update_${entitySnake}(): void
    {
        $${entitySnake} = ${entityPascal}::create([
${sampleData}
        ]);

        $response = $this->put(route('${entityPlural}.update', $${entitySnake}), [
${sampleData}
        ]);

        $this->assertTrue(in_array($response->getStatusCode(), [200, 201, 302]));
    }

    public function test_can_destroy_${entitySnake}(): void
    {
        $${entitySnake} = ${entityPascal}::create([
${sampleData}
        ]);

        $response = $this->delete(route('${entityPlural}.destroy', $${entitySnake}));

        $this->assertTrue(in_array($response->getStatusCode(), [200, 201, 302, 204]));
    }
}
`
}

export function executeCrudGenerator(args: Record<string, unknown>) {
  const steps: StepResult[] = []
  let testResult = ""

  try {
    const entity = String(args.entity ?? "").trim()
    if (!entity) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "'entity' argument is required" }) }],
        isError: true as const,
      }
    }

    const table = args.table ? String(args.table).trim() : snakeCase(pluralize(entity))
    const fields = parseFields(String(args.fields ?? ""))
    const { projectPath } = getConfig()

    const entityPascal = toPascalCase(entity)
    const entitySnake = snakeCase(entity)
    const entityPlural = snakeCase(pluralize(entity))

    // Step 1: Migration
    {
      const step: StepResult = { step: 1, action: "create migration", status: "skipped" }
      try {
        if (hasExistingMigration(projectPath, table)) {
          step.status = "skipped"
          step.error = `Migration for table '${table}' already exists`
        } else {
          const output = runArtisan(`make:migration create_${entityPlural}_table --create=${table}`)
          const migrationFile = findMigrationFile(projectPath, table)
          if (migrationFile) {
            step.status = "done"
            step.file = migrationFile.replace(projectPath, "").replace(/^\//, "")

            let content = readFileSync(migrationFile, "utf-8")
            const columnDefs = fields.map(f => `            ${getMigrationColumn(f)}`).join("\n")
            if (columnDefs) {
              content = content.replace(/(\$table->id\(\);)/, `$1\n${columnDefs}`)
            }
            writeFileSync(migrationFile, content)
          } else {
            step.status = "failed"
            step.error = `Could not find migration file for table '${table}'`
            if (output) step.error += `: ${output.substring(0, 200)}`
          }
        }
      } catch (err) {
        step.status = "failed"
        step.error = String(err)
      }
      steps.push(step)
    }

    // Step 2: Model
    {
      const step: StepResult = { step: 2, action: "create model", status: "skipped" }
      try {
        const modelFile = join(projectPath, "app", "Models", `${entityPascal}.php`)
        const modelExists = existsSync(modelFile)
        if (!modelExists) {
          runArtisan(`make:model ${entityPascal}`)
        }

        if (existsSync(modelFile)) {
          step.status = "done"
          step.file = `app/Models/${entityPascal}.php`

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
        } else {
          step.status = "failed"
          step.error = `Model file not found at app/Models/${entityPascal}.php`
        }
      } catch (err) {
        step.status = "failed"
        step.error = String(err)
      }
      steps.push(step)
    }

    // Step 3: Controller
    {
      const step: StepResult = { step: 3, action: "create controller", status: "skipped" }
      try {
        const controllerFile = join(projectPath, "app", "Http", "Controllers", `${entityPascal}Controller.php`)
        if (!existsSync(controllerFile)) {
          runArtisan(`make:controller ${entityPascal}Controller --resource --model=${entityPascal}`)
        }
        if (existsSync(controllerFile)) {
          step.status = "done"
          step.file = `app/Http/Controllers/${entityPascal}Controller.php`
        } else {
          step.status = "failed"
          step.error = `Controller file not found`
        }
      } catch (err) {
        step.status = "failed"
        step.error = String(err)
      }
      steps.push(step)
    }

    // Step 4: Form Request
    {
      const step: StepResult = { step: 4, action: "create form request", status: "skipped" }
      try {
        const requestFile = join(projectPath, "app", "Http", "Requests", `Store${entityPascal}Request.php`)
        if (!existsSync(requestFile)) {
          runArtisan(`make:request Store${entityPascal}Request`)
        }
        if (existsSync(requestFile)) {
          step.status = "done"
          step.file = `app/Http/Requests/Store${entityPascal}Request.php`

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
        } else {
          step.status = "failed"
          step.error = `Form request file not found`
        }
      } catch (err) {
        step.status = "failed"
        step.error = String(err)
      }
      steps.push(step)
    }

    // Step 5: Route
    {
      const step: StepResult = { step: 5, action: "add resource route", status: "skipped" }
      try {
        let routeFile = join(projectPath, "routes", "web.php")
        if (!existsSync(routeFile)) {
          routeFile = join(projectPath, "routes", "api.php")
        }

        if (existsSync(routeFile)) {
          step.status = "done"
          step.file = routeFile.replace(projectPath, "").replace(/^\//, "")

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
        } else {
          step.status = "failed"
          step.error = "No routes file found (routes/web.php or routes/api.php)"
        }
      } catch (err) {
        step.status = "failed"
        step.error = String(err)
      }
      steps.push(step)
    }

    // Step 6: Test
    {
      const step: StepResult = { step: 6, action: "create feature test", status: "skipped" }
      try {
        const testFile = join(projectPath, "tests", "Feature", `${entityPascal}Test.php`)
        if (!existsSync(testFile)) {
          runArtisan(`make:test ${entityPascal}Test`)
        }
        if (existsSync(testFile)) {
          step.status = "done"
          step.file = `tests/Feature/${entityPascal}Test.php`
          const existingColumns = getTableColumnsFromMigrations(projectPath, table)
          const testContent = generateTestContent(entityPascal, entitySnake, entityPlural, fields, existingColumns)
          writeFileSync(testFile, testContent)
        } else {
          step.status = "failed"
          step.error = `Test file not found`
        }
      } catch (err) {
        step.status = "failed"
        step.error = String(err)
      }
      steps.push(step)
    }

    // Step 7: Run tests
    {
      const step: StepResult = { step: 7, action: "run tests", status: "skipped" }
      try {
        const output = runArtisan(`test --filter ${entityPascal}Test`)
        testResult = output
        step.status = "done"
      } catch (err) {
        step.status = "done"
        testResult = String(err)
      }
      steps.push(step)
    }

    const summary = `Created ${entityPascal} CRUD: ${steps.filter(s => s.status === "done").length} of ${steps.length} steps completed`

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ steps, testResult, summary }, null, 2),
      }],
    }
  } catch (err) {
    logger.error("crudGenerator failed", { error: String(err) })
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ error: String(err), steps }, null, 2),
      }],
      isError: true as const,
    }
  }
}
