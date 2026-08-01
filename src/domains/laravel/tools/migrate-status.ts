import { runArtisan } from "../mcp.js"
import { success, failure } from "../../../core/tool-helper.js"

export function executeMigrateStatus() {
  try {
    return success(runArtisan("migrate:status"))
  } catch (err) {
    return failure("migrateStatus", err)
  }
}
