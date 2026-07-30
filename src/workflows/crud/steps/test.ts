import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs"
import { join } from "path"
import { runArtisan } from "../../../mcp.js"
import type { FieldDef, StepResult } from "../planner.js"

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

function generateTestContent(
  entityPascal: string,
  entitySnake: string,
  entityPlural: string,
  fields: FieldDef[],
  existingColumns: string[],
): string {
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

export async function execute(params: Record<string, unknown>, projectPath: string): Promise<StepResult> {
  const entityPascal = params.entityPascal as string
  const entitySnake = params.entitySnake as string
  const entityPlural = params.entityPlural as string
  const table = params.table as string
  const fields = params.fields as FieldDef[]

  const testFile = join(projectPath, "tests", "Feature", `${entityPascal}Test.php`)
  if (!existsSync(testFile)) {
    runArtisan(`make:test ${entityPascal}Test`)
  }

  if (!existsSync(testFile)) {
    return { status: "failed", error: "Test file not found" }
  }

  const existingColumns = getTableColumnsFromMigrations(projectPath, table)
  const testContent = generateTestContent(entityPascal, entitySnake, entityPlural, fields, existingColumns)
  writeFileSync(testFile, testContent)

  let testOutput = ""
  try {
    const output = runArtisan(`test --filter ${entityPascal}Test`)
    testOutput = output
  } catch (err) {
    testOutput = String(err)
  }

  return { status: "done", file: `tests/Feature/${entityPascal}Test.php`, testOutput }
}
