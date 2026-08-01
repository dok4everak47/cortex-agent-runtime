import { describe, it } from "node:test"
import assert from "node:assert"
import { filterRoutes, formatRouteList, type RouteEntry } from "../domains/laravel/tools/route-list.js"

const MOCK_ROUTES: RouteEntry[] = [
  {
    domain: null,
    method: "GET|HEAD",
    uri: "notes",
    name: "notes.index",
    action: "App\\Http\\Controllers\\NoteController@index",
    middleware: ["web"],
  },
  {
    domain: null,
    method: "POST",
    uri: "notes",
    name: "notes.store",
    action: "App\\Http\\Controllers\\NoteController@store",
    middleware: ["web"],
  },
  {
    domain: null,
    method: "GET|HEAD",
    uri: "notes/{note}",
    name: "notes.show",
    action: "App\\Http\\Controllers\\NoteController@show",
    middleware: ["web"],
  },
  {
    domain: null,
    method: "GET|HEAD",
    uri: "dashboard",
    name: "dashboard",
    action: "App\\Http\\Controllers\\DashboardController@index",
    middleware: ["web", "auth"],
  },
  {
    domain: null,
    method: "DELETE",
    uri: "notes/{note}",
    name: null,
    action: "App\\Http\\Controllers\\NoteController@destroy",
    middleware: ["web"],
  },
]

describe("route-list – filterRoutes", () => {
  it("returns all routes when no filters are given", () => {
    const result = filterRoutes(MOCK_ROUTES, {})
    assert.equal(result.length, 5)
  })

  describe("by name", () => {
    it("filters routes matching name substring", () => {
      const result = filterRoutes(MOCK_ROUTES, { name: "notes" })
      assert.equal(result.length, 3)
      assert.ok(result.every((r) => r.name?.toLowerCase().includes("notes")))
    })

    it("returns empty for non-matching name", () => {
      const result = filterRoutes(MOCK_ROUTES, { name: "nonexistent" })
      assert.equal(result.length, 0)
    })

    it("handles routes with null name", () => {
      const result = filterRoutes(MOCK_ROUTES, { name: "unnamed" })
      assert.equal(result.length, 0)
    })
  })

  describe("by uri", () => {
    it("filters routes matching uri pattern", () => {
      const result = filterRoutes(MOCK_ROUTES, { uri: "notes" })
      assert.equal(result.length, 4)
      assert.ok(result.every((r) => r.uri.includes("notes")))
    })

    it("filters by exact uri", () => {
      const result = filterRoutes(MOCK_ROUTES, { uri: "dashboard" })
      assert.equal(result.length, 1)
      assert.equal(result[0].uri, "dashboard")
    })
  })

  describe("by method", () => {
    it("filters by POST", () => {
      const result = filterRoutes(MOCK_ROUTES, { method: "POST" })
      assert.equal(result.length, 1)
      assert.equal(result[0].method, "POST")
    })

    it("filters by DELETE", () => {
      const result = filterRoutes(MOCK_ROUTES, { method: "DELETE" })
      assert.equal(result.length, 1)
      assert.equal(result[0].method, "DELETE")
    })

    it("mathes method substring for combined methods (e.g. GET|HEAD)", () => {
      const result = filterRoutes(MOCK_ROUTES, { method: "GET" })
      assert.equal(result.length, 3)
    })
  })

  describe("combined filters", () => {
    it("applies name + method filter together", () => {
      const result = filterRoutes(MOCK_ROUTES, { name: "notes", method: "POST" })
      assert.equal(result.length, 1)
      assert.equal(result[0].name, "notes.store")
    })

    it("applies name + uri filter", () => {
      const result = filterRoutes(MOCK_ROUTES, { name: "notes", uri: "{note}" })
      // notes.show – name includes "notes" and uri includes "{note}"
      assert.equal(result.length, 1)
      assert.equal(result[0].name, "notes.show")
    })
  })
})

describe("route-list – formatRouteList", () => {
  it("returns empty message for empty routes", () => {
    assert.equal(formatRouteList([]), "No routes matched the filters.")
  })

  it("includes header and separator", () => {
    const output = formatRouteList(MOCK_ROUTES.slice(0, 1))
    assert.ok(output.startsWith("METHOD"))
    assert.ok(output.includes("─"))
  })

  it("includes route details", () => {
    const output = formatRouteList(MOCK_ROUTES.slice(0, 1))
    assert.ok(output.includes("notes.index"))
    assert.ok(output.includes("GET|HEAD"))
  })
})
