import { readdirSync, statSync } from "fs"
import { join } from "path"
import { getConfig } from "../../../core/mcp.js"
import { success, failure } from "../../../core/tool-helper.js"

const EXCLUDED_DIRS = new Set([".git", "node_modules", "vendor"])
const MAX_DEPTH = 2

function isExcluded(name: string): boolean {
  return EXCLUDED_DIRS.has(name)
}

function walk(dir: string, depth: number, lines: string[], prefix: string): void {
  if (depth > MAX_DEPTH) return
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  entries.sort()
  for (const entry of entries) {
    if (isExcluded(entry)) continue
    const full = join(dir, entry)
    let isDir = false
    try {
      isDir = statSync(full).isDirectory()
    } catch {
      continue
    }
    lines.push(prefix + entry + (isDir ? "/" : ""))
    if (isDir) walk(full, depth + 1, lines, prefix + "  ")
  }
}

export function executeProjectTree() {
  try {
    const { projectPath } = getConfig()
    const lines: string[] = []
    walk(projectPath, 1, lines, "")
    return success(lines.join("\n") || "(empty project)")
  } catch (err) {
    return failure("projectTree", err)
  }
}
