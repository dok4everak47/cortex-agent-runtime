import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { ToolRegistry } from "./core/registry.js"
import { getConfig, getLogger } from "./core/mcp.js"
import { detectDomains } from "./core/detector.js"
import { registerContextResource } from "./domains/laravel/context/resource.js"
import { contextManager } from "./domains/laravel/context/context-manager.js"

const logger = getLogger()

const { projectPath } = getConfig()
const domains = detectDomains(projectPath)
const registry = new ToolRegistry()
for (const domain of domains) {
  registry.registerDomain(domain)
}

const server = new Server(
  { name: "cortex-agent-runtime", version: "1.0.0-beta.1" },
  { capabilities: { tools: {}, resources: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  logger.info("tools/list called")
  return { tools: registry.listTools() }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  return registry.callTool(name, args ?? {})
})

if (domains.some((d) => d.id === "laravel")) {
  registerContextResource(server, (p) => contextManager.getContext(p))
}

const transport = new StdioServerTransport()
await server.connect(transport)
