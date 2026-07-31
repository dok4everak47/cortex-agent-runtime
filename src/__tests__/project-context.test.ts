import { describe, it, mock, before } from "node:test"
import assert from "node:assert"

describe("projectContext tool", () => {
  before(() => {
    mock.module("../mcp.js", {
      exports: {
        getConfig: () => ({ projectPath: "/tmp/fake", phpPath: "php" }),
        getLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
      },
    })
    mock.module("../context/context-manager.js", {
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
            builtAt: 123,
            source: force ? "realtime" : "cache",
          }),
        },
      },
    })
  })

  it("returns serialized context json", async () => {
    const { executeProjectContext } = await import("../tools/project-context.js")
    const result = await executeProjectContext({})
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes('"source": "cache"'))
    assert.ok(result.content[0].text.includes('"laravel"'))
  })

  it("passes force flag through to the manager", async () => {
    const { executeProjectContext } = await import("../tools/project-context.js")
    const result = await executeProjectContext({ force: true })
    assert.equal(result.isError, false)
    assert.ok(result.content[0].text.includes('"source": "realtime"'))
  })
})
