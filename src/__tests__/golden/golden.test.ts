import { after, before, test } from "node:test"
import assert from "node:assert"
import { resolve } from "path"
import { SCENARIOS } from "./scenarios.js"
import { formatChecks, prepareTestProject, runScenario, teardownTestProject } from "./runner.js"

// E2E golden benchmark. Requires a real Laravel project as the source:
//   - default: sibling directory `../blog` (relative to this repo)
//   - override with GOLDEN_SOURCE_PROJECT=/path/to/laravel
//
// Each scenario runs against a fresh throwaway copy of the source project, so
// the source is never modified. Run manually:
//   npx tsx --test src/__tests__/golden/golden.test.ts
//   npx tsx --test --test-name-pattern "crud-post" src/__tests__/golden/golden.test.ts

function defaultSource(): string {
  return resolve(process.cwd(), "..", "blog")
}

const sourceProject = process.env.GOLDEN_SOURCE_PROJECT || defaultSource()
let projectPath = ""

before(() => {
  projectPath = prepareTestProject(sourceProject)
})

after(() => {
  teardownTestProject(projectPath)
})

for (const scenario of SCENARIOS) {
  test(`golden:${scenario.id} ${scenario.name}`, async () => {
    const result = await runScenario(scenario, projectPath)
    assert.ok(result.passed, formatChecks(result))
  })
}
