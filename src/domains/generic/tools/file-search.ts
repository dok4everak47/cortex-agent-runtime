import { collectPattern } from "../../../core/glob.js"
import { getConfig } from "../../../core/mcp.js"
import { success, failure } from "../../../core/tool-helper.js"

const EXCLUDED_DIRS = new Set([".git", "node_modules", "vendor"])

function isExcluded(abs: string, projectPath: string): boolean {
  const rel = abs.slice(projectPath.length + 1)
  return rel.split("/").some((seg) => EXCLUDED_DIRS.has(seg))
}

export function collectFiles(root: string, pattern: string): string[] {
  return collectPattern(root, pattern).filter((f) => !isExcluded(f, root))
}

export function executeFileSearch(args: Record<string, unknown>) {
  try {
    const pattern = String(args.pattern ?? "").trim()
    if (!pattern) {
      return failure("fileSearch", new Error("'pattern' argument is required"))
    }
    const { projectPath } = getConfig()
    const files = collectFiles(projectPath, pattern).map((f) => f.slice(projectPath.length + 1))
    return success(files.join("\n") || "(no matches)")
  } catch (err) {
    return failure("fileSearch", err)
  }
}
