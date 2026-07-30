import { describe, it, mock, before, after } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

describe("envInfoSafe", () => {
  let tmpDir: string

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "envinfo-test-"))
    writeFileSync(join(tmpDir, ".env"), [
      "APP_NAME=Laravel",
      "APP_KEY=base64:abc123",
      "DB_PASSWORD=secret",
      "DB_HOST=localhost",
      "MAIL_PASSWORD=pass123",
      "MAIL_USERNAME=admin@example.com",
      "APP_DEBUG=true",
      "STRIPE_SECRET=sk_test_xxx",
      "SESSION_DRIVER=file",
    ].join("\n"))

    mock.module("../mcp.js", {
      exports: {
        getConfig: () => ({ projectPath: tmpDir, phpPath: "php" }),
        getLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
      },
    })
  })

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("filters sensitive values from .env", async () => {
    const { executeEnvInfoSafe } = await import("../tools/env-info-safe.js")
    const result = executeEnvInfoSafe()
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes("APP_NAME=Laravel"))
    assert.ok(result.content[0].text.includes("DB_HOST=localhost"))
    assert.ok(result.content[0].text.includes("APP_DEBUG=true"))
    assert.ok(result.content[0].text.includes("MAIL_USERNAME=admin@example.com"))
    assert.ok(result.content[0].text.includes("SESSION_DRIVER=file"))
  })

  it("removes APP_KEY, DB_PASSWORD, and SECRET values", async () => {
    const { executeEnvInfoSafe } = await import("../tools/env-info-safe.js")
    const result = executeEnvInfoSafe()
    assert.equal(result.isError, false)
    assert.ok(!result.content[0].text.includes("APP_KEY"))
    assert.ok(!result.content[0].text.includes("DB_PASSWORD"))
    assert.ok(!result.content[0].text.includes("MAIL_PASSWORD"))
    assert.ok(!result.content[0].text.includes("STRIPE_SECRET"))
  })

  it("returns error when .env file is missing", async () => {
    rmSync(join(tmpDir, ".env"))
    assert.ok(!existsSync(join(tmpDir, ".env")))
    const { executeEnvInfoSafe } = await import("../tools/env-info-safe.js")
    const result = executeEnvInfoSafe()
    assert.ok(result.isError)
    assert.ok(result.content[0].text.includes(".env file not found"))
  })
})
