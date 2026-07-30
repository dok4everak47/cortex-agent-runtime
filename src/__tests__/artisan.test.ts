import { describe, it } from "node:test"
import assert from "node:assert"
import { isArtisanAllowed, ALLOWED_ARTISAN_COMMANDS, executeArtisan } from "../tools/artisan.js"

describe("artisan – isArtisanAllowed (pure function)", () => {
  it("allows whitelisted commands", () => {
    const allowed = ["migrate", "make:model Post", "route:list --json", "test", "env"]
    for (const cmd of allowed) {
      assert.ok(isArtisanAllowed(cmd), `expected '${cmd}' to be allowed`)
    }
  })

  it("rejects non-whitelisted commands", () => {
    const denied = ["db:wipe", "down", "up", "package:discover", "storage:link"]
    for (const cmd of denied) {
      assert.ok(!isArtisanAllowed(cmd), `expected '${cmd}' to be denied`)
    }
  })

  it("considers only the first word of the command", () => {
    assert.ok(isArtisanAllowed("migrate --force"))
    assert.ok(!isArtisanAllowed("evil --migrate"))
  })
})

describe("artisan – ALLOWED_ARTISAN_COMMANDS list", () => {
  it("includes essential commands", () => {
    const essentials = ["migrate", "route:list", "test", "env", "cache:clear"]
    for (const cmd of essentials) {
      assert.ok(ALLOWED_ARTISAN_COMMANDS.includes(cmd), `expected '${cmd}' to be in the whitelist`)
    }
  })
})

describe("artisan – executeArtisan (error handling)", () => {
  it("returns error for empty command", () => {
    const result = executeArtisan({ command: "" })
    assert.ok(result.content[0].text.includes("Error"))
  })

  it("returns error for missing command argument", () => {
    const result = executeArtisan({})
    assert.ok(result.content[0].text.includes("Error"))
  })

  it("returns error for disallowed command without calling execSync", () => {
    const result = executeArtisan({ command: "db:wipe" })
    assert.ok(result.content[0].text.includes("not allowed"))
  })
})
