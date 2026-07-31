import { existsSync, readdirSync, statSync, readFileSync } from "fs"
import { join } from "path"
import { getConfig, getLogger, runArtisan, runTinker, runCommand } from "../mcp.js"
import { analyzeComposer } from "../tools/composer-analyzer.js"
import { scanModels } from "../tools/model.js"
import { scanTables } from "../tools/schema.js"
import { collectRoutes } from "../tools/route-list.js"
import { detectFrontend } from "../tools/frontend-scanner.js"
import { clearLegacyCache, ModuleCache, type ModuleName } from "./module-cache.js"
import type { ProjectContext } from "./types.js"

const MODULES: ModuleName[] = ["project", "models", "routes", "schema", "packages"]

export type ProjectModule = {
  laravel: ProjectContext["laravel"]
  app: ProjectContext["app"]
}

export type ModuleDataMap = {
  project: ProjectModule
  models: ProjectContext["models"]
  routes: ProjectContext["routes"]
  schema: ProjectContext["tables"]
  packages: ProjectContext["packages"]
}

function safe<T>(name: string, fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch (err) {
    getLogger().warn(`context collector '${name}' failed`, {
      error: err instanceof Error ? err.message : String(err),
    })
    return fallback
  }
}

function readJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, "utf-8"))
  } catch {
    return null
  }
}

function detectFramework(projectPath: string): string {
  const composer = readJson(join(projectPath, "composer.json"))
  const require = ((composer?.require as Record<string, string> | undefined) ?? {})
  if (require["laravel/lumen-framework"]) return "Lumen"
  return "Laravel"
}

function countFiles(dir: string, predicate: (name: string) => boolean): number {
  if (!existsSync(dir)) return 0
  let count = 0
  const stack = [dir]
  while (stack.length > 0) {
    const current = stack.pop()!
    let entries
    try {
      entries = readdirSync(current)
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(current, entry)
      let stat
      try {
        stat = statSync(full)
      } catch {
        continue
      }
      if (stat.isDirectory()) {
        stack.push(full)
      } else if (predicate(entry)) {
        count++
      }
    }
  }
  return count
}

async function collectLaravelVersion(): Promise<string> {
  return safe("laravel.version", () => runArtisan("--version").split("\n")[0]?.trim() ?? "", "")
}

async function collectPhpVersion(): Promise<string> {
  return safe("php.version", () => runCommand(`${getConfig().phpPath} -v`).split("\n")[0]?.trim() ?? "", "")
}

async function collectEnvironment(): Promise<string> {
  return safe("environment", () => {
    const out = runArtisan("env").trim()
    const bracket = out.match(/\[(.+?)\]/)
    return (bracket?.[1] ?? out.replace(/^Current application environment:\s*/i, "")).trim()
  }, "")
}

async function collectDebug(): Promise<boolean> {
  return safe("debug", () => runTinker(`echo config('app.debug') ? 'true' : 'false'`).trim() === "true", false)
}

async function collectDatabase(): Promise<{ driver: string; name: string }> {
  return safe("database", () => {
    const script = `
      $driver = config('database.default');
      $name = config('database.connections.' . $driver . '.database');
      echo $driver . PHP_EOL . $name;
    `.trim()
    const [driver, name] = runTinker(script).split("\n").map((s) => s.trim())
    return { driver: driver ?? "", name: name ?? "" }
  }, { driver: "", name: "" })
}

async function collectFramework(projectPath: string): Promise<string> {
  return safe("framework", () => detectFramework(projectPath), "Laravel")
}

async function collectAppInfo(): Promise<{ name: string; url: string }> {
  return safe("app.info", () => {
    const script = `
      echo config('app.name') . PHP_EOL . config('app.url');
    `.trim()
    const [name, url] = runTinker(script).split("\n").map((s) => s.trim())
    return { name: name ?? "", url: url ?? "" }
  }, { name: "", url: "" })
}

async function collectRoutesStats(): Promise<ProjectContext["routes"]> {
  return safe("routes", () => {
    const routes = collectRoutes()
    const count = routes.length
    const named = routes
      .map((r) => r.name)
      .filter((n): n is string => Boolean(n))
      .slice(0, 50)
    const counts = new Map<string, number>()
    for (const r of routes) {
      const key = r.name ? r.name.split(".")[0] : (r.uri.split("/")[0] || "(root)")
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const groups = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v}`)
    return { count, named, groups }
  }, { count: 0, named: [], groups: [] })
}

async function collectFrontend(projectPath: string): Promise<string[]> {
  return safe("frontend", () => detectFrontend(projectPath), [])
}

async function collectStructure(projectPath: string): Promise<ProjectContext["structure"]> {
  return safe("structure", () => ({
    controllers: countFiles(join(projectPath, "app", "Http", "Controllers"), (n) => n.endsWith(".php")),
    views: countFiles(join(projectPath, "resources", "views"), (n) => n.endsWith(".blade.php")),
    migrations: countFiles(join(projectPath, "database", "migrations"), (n) => n.endsWith(".php")),
    tests: countFiles(join(projectPath, "tests"), (n) => n.endsWith(".php")),
  }), { controllers: 0, views: 0, migrations: 0, tests: 0 })
}

async function buildProjectModule(projectPath: string): Promise<ProjectModule> {
  const [
    laravelVersion,
    phpVersion,
    environment,
    debug,
    database,
    framework,
    appInfo,
  ] = await Promise.all([
    collectLaravelVersion(),
    collectPhpVersion(),
    collectEnvironment(),
    collectDebug(),
    collectDatabase(),
    collectFramework(projectPath),
    collectAppInfo(),
  ])

  return {
    laravel: { version: laravelVersion, phpVersion, environment, debug, database, framework },
    app: appInfo,
  }
}

async function buildModelsModule(): Promise<ModuleDataMap["models"]> {
  return safe("models", () => scanModels(), [])
}

async function buildRoutesModule(): Promise<ModuleDataMap["routes"]> {
  return collectRoutesStats()
}

async function buildSchemaModule(): Promise<ModuleDataMap["schema"]> {
  return safe("tables", () => scanTables(), [])
}

async function buildPackagesModule(projectPath: string): Promise<ModuleDataMap["packages"]> {
  return safe("packages", () => {
    const { packages } = analyzeComposer(projectPath, { dev: true })
    return {
      production: packages.filter((p) => p.type === "production").map((p) => p.name),
      dev: packages.filter((p) => p.type === "dev").map((p) => p.name),
    }
  }, { production: [], dev: [] })
}

async function buildModule(module: ModuleName, projectPath: string): Promise<unknown> {
  switch (module) {
    case "project":
      return buildProjectModule(projectPath)
    case "models":
      return buildModelsModule()
    case "routes":
      return buildRoutesModule()
    case "schema":
      return buildSchemaModule()
    case "packages":
      return buildPackagesModule(projectPath)
  }
}

function collectModuleDeps(cache: ModuleCache, module: ModuleName): Record<string, number> {
  switch (module) {
    case "project":
      return cache.collectDeps(["artisan", ".env", "composer.json"])
    case "models":
      return cache.collectDeps(["app/Models/**/*.php"])
    case "routes":
      return cache.collectDeps(["routes/*.php"])
    case "schema":
      return cache.collectDeps(["database/migrations/*.php", "database/migrations"])
    case "packages":
      return cache.collectDeps(["composer.json", "composer.lock"])
  }
}

interface LoadedModule {
  data: unknown
  hit: boolean
}

async function loadModule(cache: ModuleCache, module: ModuleName, projectPath: string): Promise<LoadedModule> {
  const deps = collectModuleDeps(cache, module)
  const cached = cache.get<unknown>(module)
  if (cached && cache.isFresh(cached, deps)) {
    getLogger().debug("context module cache hit", { module, projectPath })
    return { data: cached.data, hit: true }
  }

  getLogger().debug("building context module", { module, projectPath })
  const data = await buildModule(module, projectPath)
  cache.set(module, data, deps)
  return { data, hit: false }
}

/** Build (or reuse from cache) a single context module. */
export async function buildContextModule(module: ModuleName, projectPath: string): Promise<unknown> {
  const cache = new ModuleCache(projectPath)
  const { data } = await loadModule(cache, module, projectPath)
  return data
}

/** Aggregate all modules into a full ProjectContext, each module using its own cache. */
export async function getContext(projectPath: string): Promise<ProjectContext> {
  clearLegacyCache(projectPath)

  const cache = new ModuleCache(projectPath)
  const results = await Promise.all(MODULES.map((module) => loadModule(cache, module, projectPath)))

  const [project, models, routes, schema, packages] = results.map((r) => r.data) as [
    ProjectModule,
    ModuleDataMap["models"],
    ModuleDataMap["routes"],
    ModuleDataMap["schema"],
    ModuleDataMap["packages"],
  ]

  const [frontend, structure] = await Promise.all([
    collectFrontend(projectPath),
    collectStructure(projectPath),
  ])

  const ctx: ProjectContext = {
    laravel: project.laravel,
    app: project.app,
    models,
    tables: schema,
    routes,
    packages,
    frontend,
    structure,
    builtAt: Date.now(),
    source: results.every((r) => r.hit) ? "cache" : "realtime",
  }

  getLogger().info("project context assembled", {
    projectPath,
    models: models.length,
    tables: schema.length,
    routes: routes.count,
    source: ctx.source,
  })

  return ctx
}

export const buildContext = getContext
