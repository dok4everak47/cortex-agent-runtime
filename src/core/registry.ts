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

export interface DomainManifest {
  id: string
  name: string
  description: string
  detect(projectPath: string): boolean
  getTools(): ToolDefinition[]
  getHandlers(): Record<string, ToolHandler>
  getProjectPath?(): string | undefined
}

export class ToolRegistry {
  private definitions: ToolDefinition[] = []
  private handlers: Record<string, ToolHandler> = {}

  registerDomain(manifest: DomainManifest): void {
    for (const tool of manifest.getTools()) {
      if (!this.definitions.some((d) => d.name === tool.name)) {
        this.definitions.push(tool)
      }
    }
    Object.assign(this.handlers, manifest.getHandlers())
  }

  listTools(): ToolDefinition[] {
    return this.definitions
  }

  getHandlers(): Record<string, ToolHandler> {
    return this.handlers
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
        logger.info("tool completed", { name, durationMs })
        return result
      })
      .catch((err) => {
        const durationMs = (performance.now() - start).toFixed(1)
        const msg = err instanceof Error ? err.message : String(err)
        logger.error("tool failed", { name, durationMs, error: msg })
        return {
          content: [{ type: "text", text: `Error: ${msg}` }],
          isError: true,
        }
      })
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
