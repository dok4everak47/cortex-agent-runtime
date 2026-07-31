import { describe, it } from "node:test"
import assert from "node:assert"
import { validateArguments } from "../security/command-validator.js"

describe("validateArguments", () => {
  it("allows safe commands", () => {
    const safe = ["route:list", "migrate", "make:model Post", "migrate:status --json", "env"]
    for (const cmd of safe) {
      assert.equal(validateArguments(cmd).allowed, true, `expected '${cmd}' to be allowed`)
    }
  })

  it("rejects --force", () => {
    const decision = validateArguments("migrate --force")
    assert.equal(decision.allowed, false)
    assert.equal(decision.reason, "force flag")
  })

  it("rejects rm -rf", () => {
    const decision = validateArguments("rm -rf storage")
    assert.equal(decision.allowed, false)
    assert.equal(decision.reason, "recursive delete")
  })

  it("rejects output discard", () => {
    assert.equal(validateArguments("migrate > /dev/null").allowed, false)
  })

  it("rejects chained destructive commands", () => {
    assert.equal(validateArguments("migrate && rm -rf app").allowed, false)
    assert.equal(validateArguments("migrate && drop database").allowed, false)
  })

  it("rejects pipe to shell", () => {
    assert.equal(validateArguments("route:list | bash").allowed, false)
    assert.equal(validateArguments("route:list | sh").allowed, false)
    assert.equal(validateArguments("route:list | zsh").allowed, false)
  })
})
