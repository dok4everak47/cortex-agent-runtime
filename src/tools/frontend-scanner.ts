import { readdirSync, existsSync, statSync, readFileSync } from "fs"
import { join } from "path"
import { getConfig } from "../mcp.js"
import { success, failure } from "../tool-helper.js"

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

function findFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return []
  const found: string[] = []
  const stack = [dir]
  while (stack.length > 0) {
    const current = stack.pop()!
    for (const entry of readdirSync(current)) {
      const full = join(current, entry)
      let stat
      try {
        stat = statSync(full)
      } catch {
        continue
      }
      if (stat.isDirectory()) {
        stack.push(full)
      } else if (entry.endsWith(ext)) {
        found.push(full)
      }
    }
  }
  return found
}

function readJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, "utf-8"))
  } catch {
    return null
  }
}

const FRAMEWORK_MARKERS: Array<[string, string]> = [
  ["vue", "vue"],
  ["react", "react"],
  ["inertia", "@inertiajs"],
  ["livewire", "livewire"],
  ["alpine", "alpinejs"],
  ["tailwind", "tailwindcss"],
  ["vite", "vite"],
]

export function detectFrontend(projectPath: string): string[] {
  const detected: string[] = []
  const resources = join(projectPath, "resources")

  if (findFiles(join(resources, "views"), ".blade.php").length > 0) {
    detected.push("blade")
  }

  const jsDir = join(resources, "js")
  if (existsSync(jsDir)) {
    if (findFiles(jsDir, ".vue").length > 0 && !detected.includes("vue")) detected.push("vue")
    if ((findFiles(jsDir, ".jsx").length > 0 || findFiles(jsDir, ".tsx").length > 0) && !detected.includes("react")) {
      detected.push("react")
    }
  }

  const pkg = readJson(join(projectPath, "package.json"))
  if (pkg) {
    const deps = {
      ...((pkg.dependencies as Record<string, string> | undefined) ?? {}),
      ...((pkg.devDependencies as Record<string, string> | undefined) ?? {}),
    }
    const names = Object.keys(deps)
    for (const [label, needle] of FRAMEWORK_MARKERS) {
      if (!detected.includes(label) && names.some((d) => d.includes(needle))) {
        detected.push(label)
      }
    }
  }

  return [...new Set(detected)].sort()
}

export function executeFrontendScanner() {
  try {
    const { projectPath } = getConfig()
    const resourcesPath = join(projectPath, "resources")

    if (!existsSync(resourcesPath)) {
      return failure("frontendScanner", new Error(`resources/ directory not found at ${resourcesPath}`))
    }

    const sections = [
      ...scanSection(resourcesPath, "views", "Views"),
      "",
      ...scanSection(resourcesPath, "js", "JS"),
      "",
      ...scanSection(resourcesPath, "css", "CSS"),
    ]

    return success(sections.join("\n"))
  } catch (err) {
    return failure("frontendScanner", err)
  }
}
