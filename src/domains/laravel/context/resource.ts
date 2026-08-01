import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { getConfig } from "../mcp.js"
import type { ProjectContext } from "./types.js"

type GetContext = (projectPath: string) => Promise<ProjectContext>

const CONTEXT_URI = "laravel://context"

export function registerContextResource(server: Server, getContext: GetContext) {
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: CONTEXT_URI,
        name: "Laravel Project Context",
        description: "Comprehensive project context: version, models, routes, packages",
        mimeType: "application/json",
      },
    ],
  }))

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    if (request.params.uri === CONTEXT_URI) {
      const { projectPath } = getConfig()
      const ctx = await getContext(projectPath)
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: "application/json",
            text: JSON.stringify(ctx, null, 2),
          },
        ],
      }
    }
    throw new Error(`Unknown resource: ${request.params.uri}`)
  })
}
