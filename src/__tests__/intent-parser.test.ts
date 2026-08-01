import { describe, it } from "node:test"
import assert from "node:assert"

describe("parseIntent", () => {
  it("parses a Chinese feature request", async () => {
    const { parseIntent } = await import("../domains/laravel/planner/intent-parser.js")
    const intent = parseIntent("给博客增加评论功能")
    assert.equal(intent.action, "create_feature")
    assert.equal(intent.entity, "Comment")
    assert.ok(intent.confidence > 0.5)
    assert.equal(intent.raw, "给博客增加评论功能")
  })

  it("parses a mixed-language CRUD request", async () => {
    const { parseIntent } = await import("../domains/laravel/planner/intent-parser.js")
    const intent = parseIntent("给 Post 生成 CRUD")
    assert.equal(intent.action, "create_crud")
    assert.equal(intent.entity, "Post")
  })

  it("parses a REST API request", async () => {
    const { parseIntent } = await import("../domains/laravel/planner/intent-parser.js")
    const intent = parseIntent("为 Tag 创建 REST API")
    assert.equal(intent.action, "create_api")
    assert.equal(intent.entity, "Tag")
    assert.equal(intent.options.api, true)
    assert.equal(intent.options.views, false)
  })

  it("parses a many-to-many relation request", async () => {
    const { parseIntent } = await import("../domains/laravel/planner/intent-parser.js")
    const intent = parseIntent("Post 和 User 建立多对多关系")
    assert.equal(intent.action, "add_relation")
    assert.equal(intent.entity, "Post")
    assert.deepEqual(intent.options.relation, {
      type: "belongsToMany",
      target: "User",
      on: "Post",
    })
  })

  it("parses a policy request", async () => {
    const { parseIntent } = await import("../domains/laravel/planner/intent-parser.js")
    const intent = parseIntent("给 Comment 加权限")
    assert.equal(intent.action, "add_policy")
    assert.equal(intent.entity, "Comment")
  })

  it("parses a debug request", async () => {
    const { parseIntent } = await import("../domains/laravel/planner/intent-parser.js")
    const intent = parseIntent("这个报错怎么解决")
    assert.equal(intent.action, "debug")
  })

  it("infers fields from Chinese context", async () => {
    const { parseIntent } = await import("../domains/laravel/planner/intent-parser.js")
    const intent = parseIntent("给文章加标题和内容")
    assert.equal(intent.entity, "Post")
    assert.equal(intent.fields, "title:string,content:text")
  })

  it("keeps explicit field definitions", async () => {
    const { parseIntent } = await import("../domains/laravel/planner/intent-parser.js")
    const intent = parseIntent("给 Post 生成 CRUD，字段 name:string,color:string")
    assert.equal(intent.entity, "Post")
    assert.equal(intent.fields, "name:string,color:string")
  })

  it("detects auth hint from input", async () => {
    const { parseIntent } = await import("../domains/laravel/planner/intent-parser.js")
    const intent = parseIntent("为 Comment 创建需登录的 API")
    assert.equal(intent.action, "create_api")
    assert.equal(intent.options.auth, true)
  })
})
