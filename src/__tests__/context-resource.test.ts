import { describe, it, mock, before } from "node:test"
import assert from "node:assert"
import { ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js"

describe("registerContextResource", () => {
  let handlers: { list: () => Promise<unknown>; read: (req: unknown) => Promise<unknown> }
  let getContext: (projectPath: string) => Promise<{ laravel: { version: string }; app: { name: string }; projectPath: string }>

  before(async () => {
    mock.module("../domains/laravel/mcp.js", {
      exports: {
        getConfig: () => ({ projectPath: "/tmp/fake-project", phpPath: "php" }),
        getLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
      },
    })

    const { registerContextResource } = await import("../domains/laravel/context/resource.js")
    handlers = {} as typeof handlers
    getContext = async (projectPath: string) => ({ laravel: { version: "11.0" }, app: { name: "blog" }, projectPath })

    const fakeServer = {
      setRequestHandler: (schema: unknown, handler: (req?: unknown) => Promise<unknown>) => {
        if (schema === ListResourcesRequestSchema) handlers.list = handler as never
        if (schema === ReadResourceRequestSchema) handlers.read = handler as never
      },
    }
    registerContextResource(fakeServer as never, getContext)
  })

  it("registers both resource handlers", () => {
    assert.ok(typeof handlers.list === "function")
    assert.ok(typeof handlers.read === "function")
  })

  it("lists the context resource", async () => {
    const result = (await handlers.list()) as { resources: { uri: string; name: string; mimeType: string }[] }
    assert.equal(result.resources.length, 1)
    assert.equal(result.resources[0].uri, "laravel://context")
    assert.equal(result.resources[0].name, "Laravel Project Context")
    assert.equal(result.resources[0].mimeType, "application/json")
  })

  it("reads the context resource using the project path from getConfig", async () => {
    const result = (await handlers.read({ params: { uri: "laravel://context" } })) as {
      contents: { uri: string; mimeType: string; text: string }[]
    }
    assert.equal(result.contents.length, 1)
    assert.equal(result.contents[0].uri, "laravel://context")
    assert.equal(result.contents[0].mimeType, "application/json")
    const parsed = JSON.parse(result.contents[0].text)
    assert.equal(parsed.app.name, "blog")
    assert.equal(parsed.projectPath, "/tmp/fake-project")
  })

  it("throws for unknown resource uris", async () => {
    await assert.rejects(() => handlers.read({ params: { uri: "laravel://unknown" } }))
  })
})
