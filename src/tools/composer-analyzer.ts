import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { getConfig, getLogger } from "../mcp.js"

interface ComposerPackage {
  name: string
  version: string
  type: "production" | "dev"
}

function readJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, "utf-8"))
  } catch {
    return null
  }
}

function buildVersionMap(lockPath: string): Map<string, string> {
  const versionMap = new Map<string, string>()
  const lock = readJson(lockPath) as Record<string, unknown> | null
  if (!lock) return versionMap

  const packages = (lock.packages as Array<{ name: string; version: string }>) ?? []
  for (const pkg of packages) {
    versionMap.set(pkg.name, pkg.version)
  }

  const packagesDev = (lock["packages-dev"] as Array<{ name: string; version: string }>) ?? []
  for (const pkg of packagesDev) {
    if (!versionMap.has(pkg.name)) {
      versionMap.set(pkg.name, pkg.version)
    }
  }

  return versionMap
}

function extractDeps(
  deps: Record<string, string> | undefined,
  type: "production" | "dev",
  versionMap: Map<string, string>,
): ComposerPackage[] {
  if (!deps) return []

  return Object.entries(deps)
    .filter(([name]) => name !== "php") // skip PHP version constraint
    .map(([name, constraint]) => ({
      name,
      version: versionMap.get(name) ?? constraint.replace(/^[\^~>=< ]*/, ""),
      type,
    }))
}

export interface ComposerAnalyzerArgs {
  filter?: string
  dev?: boolean
}

export function analyzeComposer(
  projectPath: string,
  args: ComposerAnalyzerArgs,
): { packages: ComposerPackage[]; productionCount: number; devCount: number } {
  const composerPath = join(projectPath, "composer.json")
  const lockPath = join(projectPath, "composer.lock")

  const logger = getLogger()

  const json = readJson(composerPath) as Record<string, unknown> | null
  if (!json) {
    logger.warn("composer.json not found", { path: composerPath })
    return { packages: [], productionCount: 0, devCount: 0 }
  }

  const versionMap = buildVersionMap(lockPath)
  logger.debug("composer.lock loaded", { packageCount: versionMap.size })

  const require = json.require as Record<string, string> | undefined
  const requireDev = json["require-dev"] as Record<string, string> | undefined

  let packages: ComposerPackage[] = [
    ...extractDeps(require, "production", versionMap),
  ]

  if (args.dev) {
    packages.push(...extractDeps(requireDev, "dev", versionMap))
  }

  // Apply filter
  if (args.filter) {
    const filter = args.filter.toLowerCase()
    packages = packages.filter((p) => p.name.toLowerCase().includes(filter))
  }

  // Sort by name
  packages.sort((a, b) => a.name.localeCompare(b.name))

  const productionCount = packages.filter((p) => p.type === "production").length
  const devCount = packages.filter((p) => p.type === "dev").length

  return { packages, productionCount, devCount }
}

function formatPackageList(packages: ComposerPackage[], title: string): string[] {
  if (packages.length === 0) return [`${title} (0):`, `  (none)`]
  const lines: string[] = [`${title} (${packages.length}):`]
  for (const pkg of packages) {
    lines.push(`  ${pkg.name.padEnd(40)}${pkg.version}`)
  }
  return lines
}

export function executeComposerAnalyzer(args: Record<string, unknown>) {
  try {
    const logger = getLogger()
    logger.info("composerAnalyzer called", { filter: args.filter, dev: args.dev })

    const { projectPath } = getConfig()
    const { packages, productionCount, devCount } = analyzeComposer(projectPath, {
      filter: args.filter as string | undefined,
      dev: Boolean(args.dev),
    })

    const prodPkgs = packages.filter((p) => p.type === "production")
    const devPkgs = packages.filter((p) => p.type === "dev")

    const lines: string[] = [
      ...formatPackageList(prodPkgs, "Production dependencies"),
      "",
      ...formatPackageList(devPkgs, "Dev dependencies"),
      "",
      `Total: ${packages.length} packages`,
    ]

    logger.info("composerAnalyzer completed", { total: packages.length })

    return { content: [{ type: "text" as const, text: lines.join("\n") }] }
  } catch (err) {
    getLogger().error("composerAnalyzer failed", { error: String(err) })
    return { content: [{ type: "text" as const, text: "Error: " + (err instanceof Error ? err.message : String(err)) }], isError: true as const }
  }
}
