import { describe, it } from "node:test"
import assert from "node:assert"
import { rmSync } from "fs"

describe("createFeature", () => {
  it("returns error for missing entity", async () => {
    const mod = await import("../domains/laravel/workflows/feature-generator.js")
    const result = await mod.executeCreateFeature({})
    assert.ok(result.isError)
    assert.ok(result.content[0].text.includes("entity"))
  })

  it("makeFeaturePlan defaults to web controller + views + web test", async () => {
    const { makeFeaturePlan } = await import("../domains/laravel/workflows/feature/planner.js")
    const plan = makeFeaturePlan("Tag", "name:string,color:string")
    assert.equal(plan.length, 7)
    assert.deepEqual(plan.map(p => p.type), [
      "migration", "model", "controller", "request", "route", "views", "test",
    ])
    const migration = plan[0].params
    assert.equal(migration.table, "tags")
    assert.deepEqual((migration.fields as { name: string; type: string }[]).map(f => f.name), ["name", "color"])
  })

  it("makeFeaturePlan skips views when views=false", async () => {
    const { makeFeaturePlan } = await import("../domains/laravel/workflows/feature/planner.js")
    const plan = makeFeaturePlan("Tag", "name:string", { views: false })
    assert.equal(plan.length, 6)
    assert.ok(!plan.some(p => p.type === "views"))
  })

  it("makeFeaturePlan uses api steps when api=true", async () => {
    const { makeFeaturePlan } = await import("../domains/laravel/workflows/feature/planner.js")
    const plan = makeFeaturePlan("Tag", "name:string", { api: true })
    assert.equal(plan.length, 6)
    assert.deepEqual(plan.map(p => p.type), [
      "migration", "model", "apiController", "request", "apiRoute", "apiTest",
    ])
  })

  it("generateViews produces four blade templates with resource routes", async () => {
    const { generateViews, fieldLabel } = await import("../domains/laravel/workflows/feature/steps/views.js")
    assert.equal(fieldLabel("category_id"), "Category Id")
    const views = generateViews("Tag", "tag", "tags", [{ name: "name", type: "string" }], "app")
    assert.deepEqual(Object.keys(views).sort(), ["create", "edit", "index", "show"])
    assert.ok(views.index.includes("@extends('layouts.app')"))
    assert.ok(views.index.includes("route('tags.create')"))
    assert.ok(views.index.includes("@foreach ($tags as $tag)"))
    assert.ok(views.create.includes("route('tags.store')"))
    assert.ok(views.create.includes("@csrf"))
    assert.ok(views.edit.includes("route('tags.update', $tag)"))
    assert.ok(views.edit.includes("@method('PUT')"))
    assert.ok(views.show.includes("route('tags.edit', $tag)"))
    assert.ok(!views.create.includes("@extends('layouts.app')") === false)
  })

  it("handles non-existent laravel project gracefully", async () => {
    const mod = await import("../domains/laravel/workflows/feature-generator.js")
    const tmp = `/tmp/non-existent-project-feature-${Date.now()}`
    const origPath = process.env.LARAVEL_PROJECT_PATH
    process.env.LARAVEL_PROJECT_PATH = tmp

    try {
      const result = await mod.executeCreateFeature({ entity: "Tag", fields: "name:string,color:string" })
      const parsed = JSON.parse(result.content[0].text)
      assert.ok(Array.isArray(parsed.steps))
      assert.equal(parsed.steps.length, 7)
      parsed.steps.forEach((s: { step: number; status: string }) => {
        assert.ok(["skipped", "failed", "done"].includes(s.status))
      })
      assert.ok(parsed.summary)
    } finally {
      if (origPath) {
        process.env.LARAVEL_PROJECT_PATH = origPath
      } else {
        delete process.env.LARAVEL_PROJECT_PATH
      }
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
