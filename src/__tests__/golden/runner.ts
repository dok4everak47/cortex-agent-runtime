import { execSync } from "child_process"
import { randomBytes } from "crypto"
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "fs"
import { dirname, join } from "path"
import { tmpdir } from "os"
import { runArtisan } from "../../mcp.js"
import { handleIntentPlanner } from "../../planner/index.js"
import { RunStateStore, type RunRecord } from "../../workflows/run-state.js"
import type { GoldenScenario } from "./scenarios.js"

export type ScenarioCheck = { name: string; passed: boolean; detail: string }
export type ScenarioResult = { scenarioId: string; passed: boolean; checks: ScenarioCheck[] }

function check(name: string, passed: boolean, detail = ""): ScenarioCheck {
  return { name, passed, detail }
}

export function formatChecks(result: ScenarioResult): string {
  const lines = result.checks.map(c =>
    c.passed ? `  ✓ ${c.name}` : `  ✗ ${c.name} — ${c.detail}`,
  )
  return `[${result.scenarioId}] ${result.passed ? "PASS" : "FAIL"}\n${lines.join("\n")}`
}

function safeParseJSON(text: string): Record<string, any> | null {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// ─────────────────────────────── cleanup ───────────────────────────────

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "@DOUBLE@")
    .replace(/\*/g, "[^/]*")
    .replace(/@DOUBLE@/g, ".*")
  return new RegExp(`^${escaped}$`)
}

function expandPattern(projectPath: string, pattern: string): string[] {
  if (!pattern.includes("*")) {
    const abs = join(projectPath, pattern)
    return existsSync(abs) ? [abs] : []
  }

  const segments = pattern.split("/")
  const firstStar = segments.findIndex(s => s.includes("*"))
  if (firstStar === -1) return []

  const baseDir = join(projectPath, ...segments.slice(0, firstStar))
  if (!existsSync(baseDir)) return []

  const re = globToRegExp(pattern)
  const baseRel = segments.slice(0, firstStar).join("/")
  const out: string[] = []

  const walk = (dir: string, rel: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name
      const childAbs = join(dir, entry.name)
      if (entry.isDirectory()) {
        const patternDepth = segments.length
        if (childRel.split("/").length < patternDepth) {
          walk(childAbs, childRel)
        } else if (re.test(childRel)) {
          out.push(childAbs)
        }
      } else if (re.test(childRel)) {
        out.push(childAbs)
      }
    }
  }

  walk(baseDir, baseRel)
  return out
}

const SKELETON_DIRS = [
  "app/Models",
  "app/Http/Controllers",
  "app/Http/Requests",
  "app/Http/Middleware",
  "resources/views/layouts",
  "database/migrations",
  "database/seeders",
  "routes",
  "tests/Feature",
  "tests/Unit",
]

function pruneEmptyDirs(dir: string, projectPath: string): void {
  while (dir !== projectPath && dir.startsWith(projectPath)) {
    const rel = dir.slice(projectPath.length + 1)
    if (SKELETON_DIRS.includes(rel)) break
    try {
      if (readdirSync(dir).length > 0) break
      rmSync(dir, { recursive: true, force: true })
      dir = dirname(dir)
    } catch {
      break
    }
  }
}

function removePaths(projectPath: string, patterns: string[]): void {
  for (const pattern of patterns) {
    for (const abs of expandPattern(projectPath, pattern)) {
      rmSync(abs, { recursive: true, force: true })
      pruneEmptyDirs(dirname(abs), projectPath)
    }
  }
}

// ─────────────────────── test project (option B) ───────────────────────

const SKIP_TOP = new Set([".git", ".mcp", ".supervisor", "docs", "deploy", "node_modules", "storage"])

const DEFAULT_CONTROLLER = `<?php

namespace App\\Http\\Controllers;

abstract class Controller
{
    //
}
`

const DEFAULT_LAYOUT = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@yield('title', 'Golden')</title>
</head>
<body>
    @yield('content')
</body>
</html>
`

const DEFAULT_WEB_ROUTES = `<?php

use Illuminate\\Support\\Facades\\Route;

Route::get('/', fn () => 'golden');
`

const DEFAULT_API_ROUTES = `<?php

use Illuminate\\Support\\Facades\\Route;
`

const DEFAULT_CONSOLE = `<?php

use Illuminate\\Foundation\\Inspiring;
use Illuminate\\Support\\Facades\\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote')->hourly();
`

const DEFAULT_BOOTSTRAP = `<?php

use Illuminate\\Foundation\\Application;
use Illuminate\\Foundation\\Configuration\\Exceptions;
use Illuminate\\Foundation\\Configuration\\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
`

const FEATURE_EXAMPLE_TEST = `<?php

namespace Tests\\Feature;

use Tests\\TestCase;

class ExampleTest extends TestCase
{
    public function test_the_application_returns_a_successful_response(): void
    {
        $response = $this->get('/');

        $response->assertOk();
    }
}
`

const UNIT_EXAMPLE_TEST = `<?php

namespace Tests\\Unit;

use PHPUnit\\Framework\\TestCase;

class ExampleTest extends TestCase
{
    public function test_that_true_is_true(): void
    {
        $this->assertTrue(true);
    }
}
`

function buildDotEnv(): string {
  const key = randomBytes(32).toString("base64")
  return [
    "APP_NAME=Golden",
    "APP_ENV=local",
    `APP_KEY=base64:${key}`,
    "APP_DEBUG=true",
    "APP_URL=http://localhost",
    "LOG_CHANNEL=stderr",
    "LOG_LEVEL=debug",
    "DB_CONNECTION=sqlite",
    "DB_DATABASE=:memory:",
    "SESSION_DRIVER=array",
    "CACHE_STORE=array",
    "QUEUE_CONNECTION=sync",
    "",
  ].join("\n")
}

function resolvePhpPath(sourceProject: string): string {
  try {
    execSync("php -v", { stdio: "ignore", windowsHide: true })
    return "php"
  } catch {
    // not on PATH — fall back to the nix dev shell of the source project
  }
  try {
    const out = execSync(
      `nix develop "${sourceProject}" --command bash -c 'which php'`,
      { cwd: sourceProject, encoding: "utf-8", timeout: 120_000 },
    )
    const line = out
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean)
      .pop()
    if (line?.startsWith("/")) return line
  } catch {
    // ignore and let the tool fall back to "php"
  }
  return "php"
}

const pristineRoutes = new Map<string, { web: string; api: string }>()

function snapshotRoutes(projectPath: string): void {
  const web = join(projectPath, "routes", "web.php")
  const api = join(projectPath, "routes", "api.php")
  pristineRoutes.set(projectPath, {
    web: existsSync(web) ? readFileSync(web, "utf-8") : "",
    api: existsSync(api) ? readFileSync(api, "utf-8") : "",
  })
}

function restoreRoutes(projectPath: string): void {
  const snap = pristineRoutes.get(projectPath)
  if (!snap) return
  if (snap.web) writeFileSync(join(projectPath, "routes", "web.php"), snap.web)
  if (snap.api) writeFileSync(join(projectPath, "routes", "api.php"), snap.api)
}

export function prepareTestProject(sourceProject: string): string {
  if (!existsSync(join(sourceProject, "artisan")) || !existsSync(join(sourceProject, "vendor"))) {
    throw new Error(`GOLDEN source project is not a ready Laravel app: ${sourceProject}`)
  }

  const target = mkdtempSync(join(tmpdir(), "golden-laravel-"))
  cpSync(sourceProject, target, {
    recursive: true,
    filter: src => {
      if (src === sourceProject) return true
      const rel = src.slice(sourceProject.length + 1)
      return !SKIP_TOP.has(rel.split("/")[0])
    },
  })

  const wipe = (rel: string) => rmSync(join(target, rel), { recursive: true, force: true })
  for (const rel of [
    "app/Models",
    "app/Http/Controllers",
    "app/Http/Requests",
    "app/Http/Middleware",
    "app/Policies",
    "app/Services",
    "app/Enums",
    "app/View",
    "app/Console",
    "resources/views",
    "database/migrations",
    "database/seeders",
    "routes",
    "tests/Feature",
    "tests/Unit",
    "bootstrap/cache",
  ]) {
    wipe(rel)
  }

  const mk = (rel: string) => mkdirSync(join(target, rel), { recursive: true })
  for (const rel of [
    "app/Models",
    "app/Http/Controllers",
    "app/Http/Requests",
    "app/Http/Middleware",
    "resources/views/layouts",
    "database/migrations",
    "database/seeders",
    "routes",
    "tests/Feature",
    "tests/Unit",
    "bootstrap/cache",
    "storage/app/public",
    "storage/framework/cache/data",
    "storage/framework/sessions",
    "storage/framework/views",
    "storage/logs",
  ]) {
    mk(rel)
  }

  writeFileSync(join(target, "app", "Http", "Controllers", "Controller.php"), DEFAULT_CONTROLLER)
  writeFileSync(join(target, "resources", "views", "layouts", "app.blade.php"), DEFAULT_LAYOUT)
  writeFileSync(join(target, "routes", "web.php"), DEFAULT_WEB_ROUTES)
  writeFileSync(join(target, "routes", "api.php"), DEFAULT_API_ROUTES)
  writeFileSync(join(target, "routes", "console.php"), DEFAULT_CONSOLE)
  writeFileSync(join(target, "bootstrap", "app.php"), DEFAULT_BOOTSTRAP)
  writeFileSync(join(target, "tests", "Feature", "ExampleTest.php"), FEATURE_EXAMPLE_TEST)
  writeFileSync(join(target, "tests", "Unit", "ExampleTest.php"), UNIT_EXAMPLE_TEST)
  writeFileSync(join(target, ".env"), buildDotEnv())

  process.env.PHP_PATH = resolvePhpPath(sourceProject)
  process.env.LARAVEL_PROJECT_PATH = target

  snapshotRoutes(target)
  return target
}

export function teardownTestProject(projectPath: string): void {
  if (projectPath) rmSync(projectPath, { recursive: true, force: true })
  pristineRoutes.delete(projectPath)
}

// ─────────────────────────── verification ───────────────────────────

function normalizeRoute(uri: string): string {
  return "/" + uri.replace(/^\/+/, "")
}

function listRouteUris(projectPath: string): string[] {
  const out = runArtisan("route:list --json")
  let data: unknown = null
  try {
    data = JSON.parse(out)
  } catch {
    data = null
  }

  let uris: string[] = []
  if (Array.isArray(data)) {
    uris = (data as Array<{ uri?: string }>).map(r => String(r.uri ?? ""))
  } else if (data && typeof data === "object" && Array.isArray((data as any).routes)) {
    uris = ((data as any).routes as Array<{ uri?: string }>).map(r => String(r.uri ?? ""))
  }
  if (uris.length === 0) {
    for (const line of out.split("\n")) {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 2 && parts[0].toUpperCase() !== "METHOD") uris.push(parts[1])
    }
  }
  return uris.filter(Boolean).map(normalizeRoute)
}

function removeRunRecord(projectPath: string, runId: string): void {
  rmSync(join(projectPath, ".mcp", "runs", `${runId}.json`), { force: true })
}

export async function runScenario(
  scenario: GoldenScenario,
  projectPath: string,
): Promise<ScenarioResult> {
  const checks: ScenarioCheck[] = []
  const store = new RunStateStore(projectPath)

  // 1. 清场：删除残留文件并恢复路由到初始状态
  removePaths(projectPath, scenario.cleanup)
  restoreRoutes(projectPath)
  const beforeIds = new Set(store.list().map(r => r.id))

  // 2. 调用 intentPlanner（dryRun=false 执行）
  const dryRun = scenario.dryRun === true
  const toolResult = await handleIntentPlanner({ request: scenario.request, dryRun })
  const text = toolResult.content[0]?.text ?? ""

  if (toolResult.isError) {
    checks.push(check("intentPlanner returned an error", false, text.slice(0, 400)))
  }

  const parsed = safeParseJSON(text)
  const intent = parsed?.intent
  const plan = parsed?.plan

  checks.push(
    check(
      `intent parsed → action=${intent?.action ?? "unknown"}`,
      !!(intent && intent.action),
      `mode=${parsed?.mode ?? "n/a"}`,
    ),
  )
  checks.push(
    check(
      `plan generated → ${Array.isArray(plan?.steps) ? plan.steps.length : "?"} steps`,
      Array.isArray(plan?.steps) && plan.steps.length > 0,
      "no plan steps in response",
    ),
  )

  if (dryRun) {
    checks.push(check("dryRun stayed in plan mode", parsed?.mode === "plan", `mode=${parsed?.mode ?? "n/a"}`))
    checks.push(
      check(
        "dryRun created no run record",
        !store.list().some(r => !beforeIds.has(r.id)),
        "unexpected run record found",
      ),
    )
  }

  const runId: string | undefined = parsed?.executed?.runId
  const run: RunRecord | null = runId ? store.get(runId) : null
  if (runId) {
    checks.push(check(`run record saved → ${runId}`, !!run, run ? "" : `run ${runId} not found on disk`))
  }

  // 3. 产物：期望文件必须存在
  for (const file of scenario.expect.files ?? []) {
    checks.push(check(`file exists → ${file}`, existsSync(join(projectPath, file)), file))
  }

  // 4. 路由检查
  if ((scenario.expect.routes?.length ?? 0) > 0) {
    const uris = listRouteUris(projectPath)
    for (const route of scenario.expect.routes!) {
      checks.push(
        check(
          `route exists → ${route}`,
          uris.includes(normalizeRoute(route)),
          `registered URIs: ${uris.join(", ") || "(none)"}`,
        ),
      )
    }
  }

  // 5. 运行记录检查
  if (scenario.workflow && run) {
    checks.push(check(`workflow = ${scenario.workflow}`, run.workflow === scenario.workflow, `actual: ${run.workflow}`))
    checks.push(check("run status = success", run.status === "success", `actual: ${run.status}`))
  }
  if (run && scenario.expect.artifacts?.length) {
    for (const artifact of scenario.expect.artifacts) {
      checks.push(
        check(
          `artifact recorded → ${artifact}`,
          run.artifacts.includes(artifact),
          `recorded: ${run.artifacts.join(", ") || "(none)"}`,
        ),
      )
    }
  }

  const testOutput = String(parsed?.executed?.testOutput ?? "")
  if (scenario.expect.testResult === "pass") {
    const ok = /(OK\s*\(|passed\s|Tests:.*passed)/i.test(testOutput) && !/FAILED/i.test(testOutput)
    checks.push(check("tests passed", ok, testOutput.slice(0, 300)))
  } else if (scenario.expect.testResult === "any") {
    const testStep = run?.steps.find(s => s.name === "test" || s.name === "apiTest")
    checks.push(
      check("test step ran (any result)", !testStep || testStep.status === "success", `test step status: ${testStep?.status ?? "n/a"}`),
    )
  }

  // 6. 清理：删除产生的文件 + 运行记录，恢复路由
  removePaths(projectPath, scenario.cleanup)
  if (runId) removeRunRecord(projectPath, runId)
  restoreRoutes(projectPath)

  return { scenarioId: scenario.id, passed: checks.every(c => c.passed), checks }
}
