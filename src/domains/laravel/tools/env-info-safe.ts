import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { getConfig } from "../mcp.js"
import { success, failure } from "../../../core/tool-helper.js"
import { redactText } from "../security/redactor.js"

export function executeEnvInfoSafe() {
  try {
    const { projectPath } = getConfig()
    const envPath = join(projectPath, ".env")

    if (!existsSync(envPath)) {
      return failure("envInfoSafe", new Error(`.env file not found at ${envPath}`))
    }

    const content = readFileSync(envPath, "utf-8")
    return success(redactText(content))
  } catch (err) {
    return failure("envInfoSafe", err)
  }
}
