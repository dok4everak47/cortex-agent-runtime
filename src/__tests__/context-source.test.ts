import { describe, it, mock, before } from "node:test"
import assert from "node:assert"

describe("contextSource tool", () => {
  before(() => {
    mock.module("../domains/laravel/mcp.js", {
      exports: {
        getConfig: () => ({ projectPath: "/tmp/fake", phpPath: "php" }),
        getLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
      },
    })
    mock.module("../domains/laravel/context/context-manager.js", {
      exports: {
        contextManager: {
          getContext: async (_projectPath: string, force: boolean) => ({
            laravel: { version: "v", phpVersion: "p", environment: "local", debug: false, database: { driver: "", name: "" }, framework: "Laravel" },
            app: { name: "App", url: "" },
            models: [],
            tables: [],
            routes: { count: 0, named: [], groups: [] },
            packages: { production: [], dev: [] },
            frontend: [],
            structure: { controllers: 0, views: 0, migrations: 0, tests: 0 },
            builtAt: 456,
            source: force ? "realtime" : "cache",
            sourceByModule: force
              ? { project: "realtime", models: "realtime", routes: "realtime", schema: "realtime", packages: "realtime" }
              : { project: "cache", models: "cache", routes: "cache", schema: "cache", packages: "cache" },
          }),
        },
      },
    })
  })

  it("reports per-module sources without forcing", async () => {
    const { executeContextSource } = await import("../domains/laravel/tools/context-source.js")
    const result = await executeContextSource({})
    assert.equal(result.isError, false)
    const parsed = JSON.parse(result.content[0].text)
    assert.deepEqual(parsed.modules, {
      project: "cache",
      models: "cache",
      routes: "cache",
      schema: "cache",
      packages: "cache",
    })
    assert.equal(parsed.overall, "cache")
    assert.equal(parsed.builtAt, 456)
  })

  it("reports realtime sources when force is set", async () => {
    const { executeContextSource } = await import("../domains/laravel/tools/context-source.js")
    const result = await executeContextSource({ force: true })
    assert.equal(result.isError, false)
    const parsed = JSON.parse(result.content[0].text)
    assert.equal(parsed.modules.models, "realtime")
    assert.equal(parsed.overall, "realtime")
  })
})
