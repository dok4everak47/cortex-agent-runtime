import { describe, it, mock, before, after } from "node:test"
import assert from "node:assert"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

describe("context builder", () => {
  let tmpDir: string
  let activeProject: string

  before(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "context-builder-"))
    activeProject = tmpDir

    mkdirSync(join(tmpDir, "app", "Http", "Controllers"), { recursive: true })
    mkdirSync(join(tmpDir, "resources", "views"), { recursive: true })
    mkdirSync(join(tmpDir, "database", "migrations"), { recursive: true })
    mkdirSync(join(tmpDir, "tests", "Feature"), { recursive: true })
    mkdirSync(join(tmpDir, "tests", "Unit"), { recursive: true })

    writeFileSync(join(tmpDir, "app", "Http", "Controllers", "UserController.php"), "<?php")
    writeFileSync(join(tmpDir, "resources", "views", "welcome.blade.php"), "")
    writeFileSync(join(tmpDir, "database", "migrations", "2024_01_01_create_users_table.php"), "<?php")
    writeFileSync(join(tmpDir, "tests", "Feature", "PostTest.php"), "<?php")
    writeFileSync(join(tmpDir, "tests", "Unit", "ExampleTest.php"), "<?php")

    writeFileSync(join(tmpDir, "composer.json"), JSON.stringify({
      require: { "laravel/framework": "^11.0" },
      "require-dev": { "phpunit/phpunit": "^11.0" },
    }))

    writeFileSync(join(tmpDir, "package.json"), JSON.stringify({
      devDependencies: { vue: "^3.4", vite: "^5.0" },
    }))

    mock.module("../mcp.js", {
      exports: {
        getConfig: () => ({ projectPath: activeProject, phpPath: "php" }),
        runArtisan: (sub: string) => {
          if (!existsSync(activeProject)) throw new Error("artisan failed")
          if (sub === "--version") return "Laravel Framework 11.31.0"
          if (sub === "env") return "INFO  The application environment is [local]."
          if (sub === "route:list --json") {
            return JSON.stringify([
              { domain: null, method: "GET|HEAD", uri: "posts", name: "posts.index", action: "PostController@index", middleware: ["web"] },
              { domain: null, method: "POST", uri: "posts", name: "posts.store", action: "PostController@store", middleware: ["web"] },
              { domain: null, method: "GET|HEAD", uri: "api/posts", name: "api.posts", action: "PostController@api", middleware: ["api"] },
            ])
          }
          return ""
        },
        runTinker: (script: string) => {
          if (!existsSync(activeProject)) throw new Error("tinker failed")
          if (script.includes("Schema::getTables")) return "users\nposts"
          if (script.includes("app_path('Models')")) return "App\\Models\\User\nApp\\Models\\Post"
          if (script.includes("config('app.debug')")) return "true"
          if (script.includes("config('database.default')")) return "mysql\nblog"
          if (script.includes("config('app.name')")) return "My Blog\nhttps://blog.test"
          return ""
        },
        runCommand: () => {
          if (!existsSync(activeProject)) throw new Error("php failed")
          return "PHP 8.3.6 (cli) (built: Jun 27 2024 16:31:20) ( NTS )"
        },
        getLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
      },
    })
  })

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("builds a complete context", async () => {
    activeProject = tmpDir
    const { buildContext } = await import("../context/builder.js")
    const ctx = await buildContext(tmpDir)

    assert.equal(ctx.laravel.version, "Laravel Framework 11.31.0")
    assert.equal(ctx.laravel.phpVersion, "PHP 8.3.6 (cli) (built: Jun 27 2024 16:31:20) ( NTS )")
    assert.equal(ctx.laravel.environment, "local")
    assert.equal(ctx.laravel.debug, true)
    assert.equal(ctx.laravel.framework, "Laravel")
    assert.deepEqual(ctx.laravel.database, { driver: "mysql", name: "blog" })
    assert.deepEqual(ctx.app, { name: "My Blog", url: "https://blog.test" })
    assert.deepEqual(ctx.models, ["App\\Models\\User", "App\\Models\\Post"])
    assert.deepEqual(ctx.tables, ["users", "posts"])
    assert.equal(ctx.routes.count, 3)
    assert.deepEqual(ctx.routes.named, ["posts.index", "posts.store", "api.posts"])
    assert.deepEqual(ctx.packages.production, ["laravel/framework"])
    assert.deepEqual(ctx.packages.dev, ["phpunit/phpunit"])
    assert.deepEqual(ctx.frontend, ["blade", "vite", "vue"])
    assert.deepEqual(ctx.structure, { controllers: 1, views: 1, migrations: 1, tests: 2 })
    assert.equal(ctx.source, "realtime")
    assert.ok(typeof ctx.builtAt === "number")
  })

  it("tolerates collector failures with fallbacks", async () => {
    activeProject = "/nonexistent-project"
    const { buildContext } = await import("../context/builder.js")
    const ctx = await buildContext("/nonexistent-project")

    assert.equal(ctx.laravel.version, "")
    assert.equal(ctx.laravel.phpVersion, "")
    assert.equal(ctx.laravel.environment, "")
    assert.equal(ctx.laravel.debug, false)
    assert.deepEqual(ctx.laravel.database, { driver: "", name: "" })
    assert.equal(ctx.models.length, 0)
    assert.equal(ctx.tables.length, 0)
    assert.deepEqual(ctx.routes, { count: 0, named: [], groups: [] })
    assert.deepEqual(ctx.packages, { production: [], dev: [] })
    assert.deepEqual(ctx.frontend, [])
    assert.deepEqual(ctx.structure, { controllers: 0, views: 0, migrations: 0, tests: 0 })
    assert.equal(ctx.source, "realtime")
    assert.ok(ctx.builtAt > 0)
  })
})
