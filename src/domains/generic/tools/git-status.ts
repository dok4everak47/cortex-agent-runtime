import { execSync } from "child_process"
import { getConfig } from "../../../core/mcp.js"
import { success, failure } from "../../../core/tool-helper.js"

export function executeGitStatus() {
  try {
    const { projectPath } = getConfig()
    const output = execSync("git status --short --branch", { cwd: projectPath, encoding: "utf-8" }).trim()
    return success(output || "(clean working tree)")
  } catch (err) {
    return failure("gitStatus", err)
  }
}
