import { readdirSync, existsSync, statSync } from "fs"
import { join } from "path"
import { getConfig, getLogger } from "../mcp.js"

interface FileTree {
  [key: string]: FileTree | true
}

function buildTree(dir: string, baseDir: string): FileTree | null {
  if (!existsSync(dir)) return null

  const tree: FileTree = {}
  const entries = readdirSync(dir).sort()

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      const subTree = buildTree(fullPath, baseDir)
      if (subTree !== null && Object.keys(subTree).length > 0) {
        tree[entry] = subTree
      }
    } else {
      tree[entry] = true
    }
  }

  return tree
}

function formatTree(tree: FileTree, indent: string = ""): string[] {
  const lines: string[] = []
  const entries = Object.keys(tree)

  for (const entry of entries) {
    const value = tree[entry]
    if (value === true) {
      lines.push(`${indent}${entry}`)
    } else {
      lines.push(`${indent}${entry}/`)
      lines.push(...formatTree(value, indent + "  "))
    }
  }

  return lines
}

function scanSection(resourcesPath: string, subDir: string, label: string): string[] {
  const dir = join(resourcesPath, subDir)
  const tree = buildTree(dir, resourcesPath)
  if (tree === null || Object.keys(tree).length === 0) {
    return [`${label}:`, `  (empty or not found)`]
  }
  return [`${label}:`, ...formatTree(tree, "  ")]
}

export function executeFrontendScanner() {
  try {
    const { projectPath } = getConfig()
    const resourcesPath = join(projectPath, "resources")

    if (!existsSync(resourcesPath)) {
      return { content: [{ type: "text" as const, text: "Error: resources/ directory not found at " + resourcesPath }], isError: true as const }
    }

    const sections = [
      ...scanSection(resourcesPath, "views", "Views"),
      "",
      ...scanSection(resourcesPath, "js", "JS"),
      "",
      ...scanSection(resourcesPath, "css", "CSS"),
    ]

    return { content: [{ type: "text" as const, text: sections.join("\n") }] }
  } catch (err) {
    getLogger().error("frontendScanner failed", { error: String(err) })
    return { content: [{ type: "text" as const, text: "Error: " + (err instanceof Error ? err.message : String(err)) }], isError: true as const }
  }
}
