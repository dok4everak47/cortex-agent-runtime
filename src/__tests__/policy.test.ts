import { describe, it } from "node:test"
import assert from "node:assert"
import { CommandPolicy, defaultPolicy } from "../domains/laravel/security/policy.js"

describe("CommandPolicy", () => {
  it("allows whitelisted commands", () => {
    const policy = new CommandPolicy()
    const allowed = ["migrate", "route:list", "make:model Post", "test", "cache:clear", "env"]
    for (const cmd of allowed) {
      assert.equal(policy.evaluate(cmd).allowed, true, `expected '${cmd}' to be allowed`)
    }
  })

  it("rejects commands not in the allowed list", () => {
    const policy = new CommandPolicy()
    const denied = ["down", "up", "package:discover", "storage:link", "serve"]
    for (const cmd of denied) {
      assert.equal(policy.evaluate(cmd).allowed, false, `expected '${cmd}' to be denied`)
    }
  })

  it("rejects hard-blocked commands even when partially matching", () => {
    const policy = new CommandPolicy()
    assert.equal(policy.evaluate("db:wipe").allowed, false)
    assert.equal(policy.evaluate("db:wipe --force").allowed, false)
    assert.equal(policy.evaluate("tinker").allowed, false)
    assert.equal(policy.evaluate("migrate:fresh").allowed, false)
    assert.equal(policy.evaluate("composer install").allowed, false)
    assert.equal(policy.evaluate("vendor:publish --force").allowed, false)
  })

  it("returns matchedRule and reason on rejection", () => {
    const policy = new CommandPolicy()
    const decision = policy.evaluate("db:wipe --force")
    assert.equal(decision.allowed, false)
    assert.equal(decision.matchedRule, "db:wipe")
    assert.ok(decision.reason)

    const patternDecision = policy.evaluate("vendor:publish --force")
    assert.equal(patternDecision.matchedRule, "vendor:publish --force")
  })

  it("rejects empty commands", () => {
    const policy = new CommandPolicy()
    assert.equal(policy.evaluate("").allowed, false)
    assert.equal(policy.evaluate("   ").allowed, false)
  })

  it("addAllowed and addDenied mutate the sets", () => {
    const policy = new CommandPolicy()
    assert.equal(policy.evaluate("storage:link").allowed, false)
    policy.addAllowed("storage:link")
    assert.equal(policy.evaluate("storage:link").allowed, true)
    policy.addDenied("storage:link")
    assert.equal(policy.evaluate("storage:link").allowed, false)
  })

  it("custom config overrides defaults", () => {
    const policy = new CommandPolicy({ allowed: ["hello"], denied: ["hello"] })
    assert.deepEqual(policy.getAllowedCommands(), ["hello"])
    assert.equal(policy.evaluate("hello").allowed, false)
  })

  it("defaultPolicy exposes the whitelist", () => {
    assert.ok(defaultPolicy.getAllowedCommands().includes("migrate"))
    assert.ok(defaultPolicy.getAllowedCommands().includes("route:list"))
  })
})
