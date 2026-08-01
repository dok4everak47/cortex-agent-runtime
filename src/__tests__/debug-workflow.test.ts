import { describe, it } from "node:test"
import assert from "node:assert"

describe("debugWorkflow", () => {
  it("returns error for missing error", async () => {
    const mod = await import("../domains/laravel/workflows/debug-workflow.js")
    const result = await mod.executeDebugWorkflow({})
    assert.ok(result.isError)
    assert.ok(result.content[0].text.includes("error"))
  })

  it("diagnoseError maps known error patterns", async () => {
    const { diagnoseError } = await import("../domains/laravel/workflows/debug/steps/diagnose.js")

    const db = diagnoseError("SQLSTATE[42P01]: Table not found")
    assert.ok(db.some(d => d.pattern === "SQLSTATE / PDOException"))

    const cls = diagnoseError('Illuminate\\Container\\EntryNotFoundException: Class "App\\Models\\Foo" not found')
    assert.ok(cls.some(d => d.pattern === "Class ... not found"))
    assert.ok(cls.find(d => d.pattern === "Class ... not found")!.cause.includes("Foo"))

    const method = diagnoseError("Call to undefined method App\\Models\\Post::authors()")
    assert.ok(method.some(d => d.pattern === "Method ... not defined"))

    const csrf = diagnoseError("419 | Page Expired")
    assert.ok(csrf.some(d => d.pattern === "419 / CSRF token mismatch"))

    const view = diagnoseError("View [blog.posts] not found.")
    assert.ok(view.some(d => d.pattern === "View ... not found"))
    assert.ok(view.find(d => d.pattern === "View ... not found")!.cause.includes("blog.posts"))
  })

  it("diagnoseError falls back to unknown pattern", async () => {
    const { diagnoseError } = await import("../domains/laravel/workflows/debug/steps/diagnose.js")
    const result = diagnoseError("Something totally unexpected happened")
    assert.equal(result.length, 1)
    assert.equal(result[0].pattern, "Unknown")
  })

  it("extractFileFromError extracts file and line", async () => {
    const { extractFileFromError } = await import("../domains/laravel/workflows/debug/planner.js")

    const abs = extractFileFromError("#0 /home/user/blog/app/Http/Controllers/PostController.php:45")
    assert.deepEqual(abs, { file: "/home/user/blog/app/Http/Controllers/PostController.php", line: 45 })

    const rel = extractFileFromError("routes/web.php:12")
    assert.deepEqual(rel, { file: "routes/web.php", line: 12 })

    const view = extractFileFromError("View [blog.posts] not found.")
    assert.deepEqual(view, { file: "blog.posts" })

    assert.equal(extractFileFromError("just a message"), null)
  })

  it("extractErrorMessage strips exception prefix", async () => {
    const { extractErrorMessage } = await import("../domains/laravel/workflows/debug/planner.js")
    assert.equal(
      extractErrorMessage("Illuminate\\Database\\QueryException: SQLSTATE[42P01] Table not found"),
      "SQLSTATE[42P01] Table not found",
    )
    assert.equal(extractErrorMessage("Error: Class \"X\" not found"), "Class \"X\" not found")
    assert.equal(extractErrorMessage("plain message"), "plain message")
  })

  it("makeDebugPlan has four steps in order", async () => {
    const { makeDebugPlan } = await import("../domains/laravel/workflows/debug/planner.js")
    const plan = makeDebugPlan("SQLSTATE[42P01]: Table not found")
    assert.equal(plan.length, 4)
    assert.deepEqual(plan.map(p => p.type), ["locate", "analyze", "diagnose", "suggest"])
  })

  it("executes against non-existent project and still diagnoses", async () => {
    const mod = await import("../domains/laravel/workflows/debug-workflow.js")
    const origPath = process.env.LARAVEL_PROJECT_PATH
    process.env.LARAVEL_PROJECT_PATH = "/tmp/non-existent-project-debug-xxxx"

    try {
      const result = await mod.executeDebugWorkflow({ error: "SQLSTATE[42P01]: Table not found" })
      assert.ok(!result.isError)
      const parsed = JSON.parse(result.content[0].text)
      assert.equal(parsed.steps.length, 4)
      assert.ok(parsed.report.includes("SQLSTATE / PDOException"))
    } finally {
      if (origPath) {
        process.env.LARAVEL_PROJECT_PATH = origPath
      } else {
        delete process.env.LARAVEL_PROJECT_PATH
      }
    }
  })

  it("analyzes a real file when a path is provided", async () => {
    const { executeDebugPlan } = await import("../domains/laravel/workflows/debug/executor.js")
    const { resolveFile, execute: locateExecute } = await import("../domains/laravel/workflows/debug/steps/locate.js")
    const { writeFileSync, mkdirSync, rmSync } = await import("fs")
    const { join } = await import("path")

    const tmp = `/tmp/debug-workflow-test-${Date.now()}`
    mkdirSync(`${tmp}/app/Models`, { recursive: true })
    writeFileSync(`${tmp}/app/Models/Post.php`, "<?php\n\nnamespace App\\Models;\n\nuse Illuminate\\Database\\Eloquent\\Model;\n\nclass Post extends Model\n{\n    // Server test marker\n}\n")

    try {
      const resolved = resolveFile(tmp, "app/Models/Post.php")
      assert.ok(resolved.file)

      const locateResult = await locateExecute({ hint: "app/Models/Post.php" }, tmp)
      assert.equal(locateResult.status, "done")

      const analyze = await import("../domains/laravel/workflows/debug/steps/analyze.js")
      const analyzeResult = await analyze.execute({ file: locateResult.file, line: 5 }, tmp)
      assert.equal(analyzeResult.status, "done")
      assert.ok((analyzeResult.content as string).includes("Server test marker"))
      assert.ok(Array.isArray(analyzeResult.snippet))

      const { execute: diagnoseExecute } = await import("../domains/laravel/workflows/debug/steps/diagnose.js")
      const diag = await diagnoseExecute({ error: "SQLSTATE[42P01]: Table not found" }, tmp)
      const { execute: suggestExecute } = await import("../domains/laravel/workflows/debug/steps/suggest.js")
      const suggest = await suggestExecute(
        { locate: locateResult, analyze: analyzeResult, diagnose: diag },
        tmp,
      )
      assert.equal(suggest.status, "done")
      assert.ok((suggest.suggestions as string[])[0].includes("app/Models/Post.php"))

      const result = await executeDebugPlan("SQLSTATE[42P01]: Table not found", "app/Models/Post.php", tmp)
      assert.equal(result.context.locate?.status, "done")
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
