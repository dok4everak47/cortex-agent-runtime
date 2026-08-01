import { getLogger } from "./mcp.js"
import { laravelDomain } from "../domains/laravel/manifest.js"

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export type ToolHandler = (args: Record<string, unknown>) => ToolResult | Promise<ToolResult>

export type ToolResult = {
  content: { type: "text"; text: string }[]
  isError?: boolean
}

export type RoleManifest = {
  id: string
  name: string
  description: string
  tools: string[]
}

export interface DomainManifest {
  id: string
  name: string
  description: string
  detect(projectPath: string): boolean
  getTools(): ToolDefinition[]
  getHandlers(): Record<string, ToolHandler>
  getProjectPath?(): string | undefined
  roles?: RoleManifest[]
}

// 单个工具的调用统计
export interface ToolStatsEntry {
  calls: number
  totalMs: number
  lastCalledAt: number
}

export interface ToolStats {
  name: string
  calls: number
  avgDurationMs: number
  lastCalledAt: number
}

export interface ToolStatsReport {
  tools: ToolStats[]
  totalCalls: number
}

export class ToolRegistry {
  private definitions: ToolDefinition[] = []
  private handlers: Record<string, ToolHandler> = {}
  private domains: DomainManifest[] = []
  private stats: Map<string, ToolStatsEntry> = new Map()

  registerDomain(manifest: DomainManifest): void {
    this.domains.push(manifest)
    for (const tool of manifest.getTools()) {
      if (!this.definitions.some((d) => d.name === tool.name)) {
        this.definitions.push(tool)
      }
    }
    Object.assign(this.handlers, manifest.getHandlers())
    if (this.handlers["listRoles"]) {
      this.handlers["listRoles"] = (args) => {
        const roles = this.listRoles()
        return { content: [{ type: "text", text: JSON.stringify(roles, null, 2) }], isError: false }
      }
    }
  }

  listTools(): ToolDefinition[] {
    return this.definitions
  }

  getHandlers(): Record<string, ToolHandler> {
    return this.handlers
  }

  listRoles(): RoleManifest[] {
    const byId = new Map<string, RoleManifest>()
    for (const domain of this.domains) {
      for (const role of domain.roles ?? []) {
        const existing = byId.get(role.id)
        if (existing) {
          existing.tools = [...new Set([...existing.tools, ...role.tools])]
        } else {
          byId.set(role.id, { id: role.id, name: role.name, description: role.description, tools: [...role.tools] })
        }
      }
    }
    return [...byId.values()]
  }

  getRoleTools(roleId: string): string[] {
    return this.listRoles().find((role) => role.id === roleId)?.tools ?? []
  }

  callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const logger = getLogger()
    const handler = this.handlers[name]
    if (!handler) {
      logger.warn("tool not found", { name })
      return Promise.resolve({
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      })
    }

    logger.info("tool called", { name, args })
    const start = performance.now()

    return Promise.resolve()
      .then(() => handler(args))
      .then((result) => {
        const durationMs = (performance.now() - start).toFixed(1)
        this.recordStat(name, durationMs)
        logger.info("tool completed", { name, durationMs })
        return result
      })
      .catch((err) => {
        const durationMs = (performance.now() - start).toFixed(1)
        this.recordStat(name, durationMs)
        const msg = err instanceof Error ? err.message : String(err)
        logger.error("tool failed", { name, durationMs, error: msg })
        return {
          content: [{ type: "text", text: `Error: ${msg}` }],
          isError: true,
        }
      })
  }

  private recordStat(name: string, durationMs: string): void {
    const entry = this.stats.get(name) ?? { calls: 0, totalMs: 0, lastCalledAt: 0 }
    entry.calls += 1
    entry.totalMs += Number(durationMs)
    entry.lastCalledAt = Date.now()
    this.stats.set(name, entry)
  }

  getToolStats(): ToolStatsReport {
    const tools: ToolStats[] = []
    for (const [name, entry] of this.stats) {
      tools.push({
        name,
        calls: entry.calls,
        avgDurationMs: entry.calls > 0 ? Math.round((entry.totalMs / entry.calls) * 10) / 10 : 0,
        lastCalledAt: entry.lastCalledAt,
      })
    }
    tools.sort((a, b) => b.calls - a.calls)
    const totalCalls = tools.reduce((sum, t) => sum + t.calls, 0)
    return { tools, totalCalls }
  }

  resetToolStats(): void {
    this.stats.clear()
  }
}

export const registry = new ToolRegistry()
registry.registerDomain(laravelDomain)

export function registerDomain(manifest: DomainManifest): void {
  registry.registerDomain(manifest)
}

export const listTools = (): ToolDefinition[] => registry.listTools()
export const callTool = (name: string, args: Record<string, unknown>): Promise<ToolResult> =>
  registry.callTool(name, args)

export const TOOL_DEFINITIONS: ToolDefinition[] = registry.listTools()
export const toolHandlers: Record<string, ToolHandler> = registry.getHandlers()

export function handleToolCall(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  return registry.callTool(name, args)
}
