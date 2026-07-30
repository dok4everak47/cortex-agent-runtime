import { describe, it } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { analyzeComposer } from "../tools/composer-analyzer.js"

describe("composer-analyzer – analyzeComposer", () => {
  let tmpDir: string

  it("returns empty for missing composer.json", () => {
    const result = analyzeComposer("/nonexistent", {})
    assert.deepEqual(result.packages, [])
    assert.equal(result.productionCount, 0)
    assert.equal(result.devCount, 0)
  })

  it("parses production dependencies from composer.json", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "composer-test-"))

    writeFileSync(join(tmpDir, "composer.json"), JSON.stringify({
      require: {
        php: "^8.1",
        "laravel/framework": "^11.0",
        "laravel/sanctum": "^4.0",
        "spatie/laravel-permission": "^6.0",
      },
    }))

    const result = analyzeComposer(tmpDir, {})
    assert.equal(result.productionCount, 3)
    assert.equal(result.devCount, 0)
    assert.equal(result.packages.length, 3)
    assert.ok(result.packages.find((p) => p.name === "laravel/framework"))
    assert.ok(result.packages.find((p) => p.name === "spatie/laravel-permission"))
    // php should be filtered out
    assert.ok(!result.packages.find((p) => p.name === "php"))

    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("reads versions from composer.lock when available", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "composer-test-"))

    writeFileSync(join(tmpDir, "composer.json"), JSON.stringify({
      require: {
        "laravel/framework": "^11.0",
        "spatie/laravel-permission": "^6.0",
      },
    }))

    writeFileSync(join(tmpDir, "composer.lock"), JSON.stringify({
      packages: [
        { name: "laravel/framework", version: "11.0.0", type: "library" },
        { name: "spatie/laravel-permission", version: "6.5.0", type: "library" },
      ],
      "packages-dev": [],
    }))

    const result = analyzeComposer(tmpDir, {})
    const framework = result.packages.find((p) => p.name === "laravel/framework")
    assert.equal(framework?.version, "11.0.0")
    const spatie = result.packages.find((p) => p.name === "spatie/laravel-permission")
    assert.equal(spatie?.version, "6.5.0")

    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("includes dev dependencies when dev flag is true", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "composer-test-"))

    writeFileSync(join(tmpDir, "composer.json"), JSON.stringify({
      require: { "laravel/framework": "^11.0" },
      "require-dev": { "barryvdh/laravel-debugbar": "^4.0" },
    }))

    // Without dev flag
    let result = analyzeComposer(tmpDir, {})
    assert.equal(result.packages.length, 1)
    assert.equal(result.productionCount, 1)
    assert.equal(result.devCount, 0)

    // With dev flag
    result = analyzeComposer(tmpDir, { dev: true })
    assert.equal(result.packages.length, 2)
    assert.equal(result.productionCount, 1)
    assert.equal(result.devCount, 1)
    assert.ok(result.packages.find((p) => p.name === "barryvdh/laravel-debugbar" && p.type === "dev"))

    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("filters packages by name", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "composer-test-"))

    writeFileSync(join(tmpDir, "composer.json"), JSON.stringify({
      require: {
        "laravel/framework": "^11.0",
        "laravel/sanctum": "^4.0",
        "spatie/laravel-permission": "^6.0",
      },
    }))

    const result = analyzeComposer(tmpDir, { filter: "laravel" })
    // Matches: laravel/framework, laravel/sanctum, spatie/laravel-permission
    assert.equal(result.packages.length, 3)
    assert.ok(result.packages.every((p) => p.name.includes("laravel")))

    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("sorts packages alphabetically", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "composer-test-"))

    writeFileSync(join(tmpDir, "composer.json"), JSON.stringify({
      require: {
        "zendframework/zend": "^3.0",
        "laravel/framework": "^11.0",
        "aws/aws-sdk-php": "^3.0",
      },
    }))

    const result = analyzeComposer(tmpDir, {})
    const names = result.packages.map((p) => p.name)
    assert.deepEqual(names, ["aws/aws-sdk-php", "laravel/framework", "zendframework/zend"])

    rmSync(tmpDir, { recursive: true, force: true })
  })
})
