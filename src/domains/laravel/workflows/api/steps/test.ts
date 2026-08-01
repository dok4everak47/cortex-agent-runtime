import { existsSync, writeFileSync } from "fs"
import { join } from "path"
import { runArtisan } from "../../../mcp.js"
import type { FieldDef } from "../../crud/planner.js"
import { getTableColumnsFromMigrations, getTestValue } from "../../crud/steps/test.js"
import type { StepOutput } from "../../run-plan.js"

export function generateApiTestContent(
  entityPascal: string,
  entitySnake: string,
  entityPlural: string,
  fields: FieldDef[],
  auth: boolean,
  existingColumns: string[],
): string {
  const uri = `/api/${entityPlural.toLowerCase()}`
  const usableFields = existingColumns.length > 0
    ? fields.filter(f => existingColumns.includes(f.name))
    : fields
  const sampleData = usableFields.length > 0
    ? usableFields.map(f => `            '${f.name}' => ${getTestValue(f)}`).join(",\n")
    : `            'name' => 'Test ${entitySnake}'`

  const imports = auth
    ? `use App\\Models\\User;\nuse Laravel\\Sanctum\\Sanctum;\n`
    : ""
  const actingAs = auth
    ? `        $user = User::factory()->create();\n        Sanctum::actingAs($user);\n`
    : ""

  return `<?php

namespace Tests\\Feature;

use App\\Models\\${entityPascal};
use Illuminate\\Foundation\\Testing\\RefreshDatabase;
use Tests\\TestCase;
${imports}class ${entityPascal}ApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_index_${entityPlural}(): void
    {
${actingAs}        $response = $this->getJson('${uri}');

        $response->assertOk();
    }

    public function test_can_store_${entitySnake}(): void
    {
${actingAs}        $response = $this->postJson('${uri}', [
${sampleData}
        ]);

        $response->assertStatus(201);
    }

    public function test_can_show_${entitySnake}(): void
    {
${actingAs}        $${entitySnake} = ${entityPascal}::create([
${sampleData}
        ]);

        $response = $this->getJson('${uri}/' . $${entitySnake}->id);

        $response->assertOk();
    }

    public function test_can_update_${entitySnake}(): void
    {
${actingAs}        $${entitySnake} = ${entityPascal}::create([
${sampleData}
        ]);

        $response = $this->putJson('${uri}/' . $${entitySnake}->id, [
${sampleData}
        ]);

        $response->assertOk();
    }

    public function test_can_destroy_${entitySnake}(): void
    {
${actingAs}        $${entitySnake} = ${entityPascal}::create([
${sampleData}
        ]);

        $response = $this->deleteJson('${uri}/' . $${entitySnake}->id);

        $response->assertNoContent();
    }
}
`
}

export async function execute(params: Record<string, unknown>, projectPath: string): Promise<StepOutput> {
  const entityPascal = params.entityPascal as string
  const entitySnake = params.entitySnake as string
  const entityPlural = params.entityPlural as string
  const table = params.table as string
  const fields = params.fields as FieldDef[]
  const auth = params.auth === true

  const testFile = join(projectPath, "tests", "Feature", `${entityPascal}ApiTest.php`)
  if (!existsSync(testFile)) {
    runArtisan(`make:test ${entityPascal}ApiTest`)
  }

  if (!existsSync(testFile)) {
    return { status: "failed", error: "API test file not found" }
  }

  const existingColumns = getTableColumnsFromMigrations(projectPath, table)
  const testContent = generateApiTestContent(entityPascal, entitySnake, entityPlural, fields, auth, existingColumns)
  writeFileSync(testFile, testContent)

  let testOutput = ""
  try {
    testOutput = runArtisan(`test --filter ${entityPascal}ApiTest`)
  } catch (err) {
    testOutput = String(err)
  }

  return { status: "done", file: `tests/Feature/${entityPascal}ApiTest.php`, testOutput }
}
