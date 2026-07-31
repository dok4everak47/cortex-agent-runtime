import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { TOOL_DEFINITIONS, handleToolCall } from "./tool-registry.js"
import { getLogger } from "./mcp.js"
import { contextManager } from "./context/index.js"
import { registerContextResource } from "./context/resource.js"

const logger = getLogger()

const server = new Server(
  { name: "laravel-mcp-server", version: "0.1.0" },
  { capabilities: { tools: {}, resources: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  logger.info("tools/list called")
  return { tools: TOOL_DEFINITIONS }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  return handleToolCall(name, args ?? {})
})

registerContextResource(server, (projectPath) => contextManager.getContext(projectPath))

const transport = new StdioServerTransport()
await server.connect(transport)
