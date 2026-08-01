import { getConfig } from "../mcp.js"
import { success, failure } from "../../../core/tool-helper.js"
import { RunStateStore, rollbackRun, type RunRecord } from "../workflows/run-state.js"
import {
  executeCrudGenerator,
  executeCreateFeature,
  executeDebugWorkflow,
  executeApiGenerator,
} from "../workflows/index.js"

function summarize(run: RunRecord): Record<string, unknown> {
  return {
    id: run.id,
    workflow: run.workflow,
    entity: run.entity,
    status: run.status,
    startedAt: run.startedAt,
    updatedAt: run.updatedAt,
    stepsDone: run.steps.filter(s => s.status === "success").length,
    stepsFailed: run.steps.filter(s => s.status === "failed").length,
    artifacts: run.artifacts.length,
  }
}

function resumeRun(run: RunRecord) {
  const args = { ...(run.args ?? {}) }
  switch (run.workflow) {
    case "createFeature": return executeCreateFeature({ ...args, resumeFrom: run.id })
    case "crudGenerator": return executeCrudGenerator({ ...args, resumeFrom: run.id })
    case "apiGenerator": return executeApiGenerator({ ...args, resumeFrom: run.id })
    case "debugWorkflow": return executeDebugWorkflow({ ...args, resumeFrom: run.id })
    default: throw new Error(`No resumable handler for workflow '${run.workflow}'`)
  }
}

export async function executeWorkflowStatus(args: Record<string, unknown>) {
  try {
    const action = String(args.action ?? "list")
    const runId = args.runId ? String(args.runId).trim() : ""
    const { projectPath } = getConfig()
    const store = new RunStateStore(projectPath)

    switch (action) {
      case "list": {
        const runs = store.list().map(summarize)
        return success(JSON.stringify({ action, runs }, null, 2))
      }
      case "get": {
        if (!runId) {
          return failure("workflowStatus", new Error("'runId' is required for action 'get'"))
        }
        const run = store.get(runId)
        if (!run) return failure("workflowStatus", new Error(`Run ${runId} not found`))
        return success(JSON.stringify({ action, run }, null, 2))
      }
      case "resume": {
        if (!runId) {
          return failure("workflowStatus", new Error("'runId' is required for action 'resume'"))
        }
        const run = store.get(runId)
        if (!run) return failure("workflowStatus", new Error(`Run ${runId} not found`))
        if (run.status === "success") {
          return failure("workflowStatus", new Error(`Run ${runId} already completed successfully`))
        }
        if (run.status === "rolled_back") {
          return failure("workflowStatus", new Error(`Run ${runId} has been rolled back`))
        }
        return await resumeRun(run)
      }
      case "rollback": {
        if (!runId) {
          return failure("workflowStatus", new Error("'runId' is required for action 'rollback'"))
        }
        const run = rollbackRun(projectPath, runId)
        return success(JSON.stringify({ action, runId, status: run.status, removedArtifacts: run.artifacts.length }, null, 2))
      }
      default:
        return failure("workflowStatus", new Error(`Unknown action '${action}'`))
    }
  } catch (err) {
    return failure("workflowStatus", err)
  }
}
