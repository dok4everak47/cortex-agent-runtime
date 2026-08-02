import { describe, it } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { detectDomains, isLaravelProject } from "../core/detector.js"

function makeDir(): string {
  return mkdtempSync(join(tmpdir(), "detector-"))
}

describe("detectDomains", () => {
  it("always includes the generic and orchestration domains", () => {
    const dir = makeDir()
    const domains = detectDomains(dir)
    assert.ok(domains.some((d) => d.id === "generic"))
    assert.ok(domains.some((d) => d.id === "orchestration"))
    assert.equal(domains.some((d) => d.id === "laravel"), false)
    rmSync(dir, { recursive: true, force: true })
  })

  it("includes the laravel domain when composer.json and artisan exist", () => {
    const dir = makeDir()
    writeFileSync(join(dir, "composer.json"), "{}")
    writeFileSync(join(dir, "artisan"), "<?php")
    const domains = detectDomains(dir)
    assert.ok(domains.some((d) => d.id === "generic"))
    assert.ok(domains.some((d) => d.id === "laravel"))
    rmSync(dir, { recursive: true, force: true })
  })

  it("excludes laravel domain when only composer.json exists", () => {
    const dir = makeDir()
    writeFileSync(join(dir, "composer.json"), "{}")
    assert.equal(detectDomains(dir).some((d) => d.id === "laravel"), false)
    rmSync(dir, { recursive: true, force: true })
  })
})

describe("isLaravelProject", () => {
  it("detects a laravel project", () => {
    const dir = makeDir()
    writeFileSync(join(dir, "composer.json"), "{}")
    writeFileSync(join(dir, "artisan"), "<?php")
    assert.equal(isLaravelProject(dir), true)
    rmSync(dir, { recursive: true, force: true })
  })

  it("rejects a non-laravel directory", () => {
    const dir = makeDir()
    mkdirSync(join(dir, "src"))
    assert.equal(isLaravelProject(dir), false)
    rmSync(dir, { recursive: true, force: true })
  })
})
