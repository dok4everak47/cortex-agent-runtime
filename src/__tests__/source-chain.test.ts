import { describe, it } from "node:test"
import assert from "node:assert"
import { resolveChain, ChainError } from "../core/source-chain.js"

describe("resolveChain", () => {
  it("tries the highest priority source first", async () => {
    const result = await resolveChain<string>([
      { name: "low", priority: 1, resolve: () => "low-value" },
      { name: "high", priority: 10, resolve: () => "high-value" },
    ])
    assert.equal(result.source, "high")
    assert.equal(result.value, "high-value")
  })

  it("falls back to the next source when resolve returns null", async () => {
    const result = await resolveChain<string>([
      { name: "cache", priority: 10, resolve: () => null },
      { name: "realtime", priority: 5, resolve: () => "built" },
    ])
    assert.equal(result.source, "realtime")
    assert.equal(result.value, "built")
  })

  it("records attempts in priority order", async () => {
    const result = await resolveChain<string>([
      { name: "cache", priority: 10, resolve: () => null },
      { name: "realtime", priority: 5, resolve: () => "built" },
      { name: "fallback", priority: 0, resolve: () => "default" },
    ])
    assert.deepEqual(result.attempts, ["cache", "realtime"])
    assert.equal(result.source, "realtime")
  })

  it("supports async resolvers", async () => {
    const result = await resolveChain<string>([
      { name: "cache", priority: 10, resolve: async () => null },
      { name: "realtime", priority: 5, resolve: async () => "async-value" },
    ])
    assert.equal(result.source, "realtime")
    assert.equal(result.value, "async-value")
  })

  it("throws ChainError when every step returns null", async () => {
    await assert.rejects(
      () =>
        resolveChain<string>([
          { name: "cache", priority: 10, resolve: () => null },
          { name: "fallback", priority: 0, resolve: () => null },
        ]),
      ChainError,
    )
  })

  it("ChainError exposes the attempted sources", async () => {
    try {
      await resolveChain<string>([
        { name: "a", priority: 1, resolve: () => null },
        { name: "b", priority: 2, resolve: () => null },
      ])
      assert.fail("should have thrown")
    } catch (err) {
      assert.ok(err instanceof ChainError)
      assert.deepEqual(err.attempts, ["b", "a"])
    }
  })

  it("treats falsy but non-null values as a successful resolve", async () => {
    const result = await resolveChain<number>([
      { name: "realtime", priority: 5, resolve: () => 0 },
    ])
    assert.equal(result.source, "realtime")
    assert.equal(result.value, 0)
  })
})
