import { runArtisan } from "../mcp.js"
import { success, failure } from "../tool-helper.js"

export function executeRunTest(args: Record<string, unknown>) {
  try {
    const filter = args.filter ? String(args.filter).trim() : ""
    const command = filter ? `test --filter ${filter}` : "test"
    return success(runArtisan(command))
  } catch (err) {
    return failure("runTest", err)
  }
}
