/**
 * Central registry for tool definitions and handlers.
 * Extracted so that tests can validate tool registration without
 * needing to import the top-level server or mock the SDK.
 */
import { executeArtisan } from "./tools/artisan.js"
import { executeMigrateStatus } from "./tools/migrate-status.js"
import { executeEnvInfo } from "./tools/env-info.js"
import { executeCache } from "./tools/cache.js"
import { executeConfigGet } from "./tools/config-get.js"
import { executeSchema } from "./tools/schema.js"
import { executeModel } from "./tools/model.js"
import { executeLog } from "./tools/log.js"
import { executeRouteList } from "./tools/route-list.js"
import { executeRunTest } from "./tools/run-test.js"
import { executeEnvInfoSafe } from "./tools/env-info-safe.js"
import { executeFrontendScanner } from "./tools/frontend-scanner.js"

export type ToolHandler = (args: Record<string, unknown>) => {
  content: { type: "text"; text: string }[]
}

interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "artisan",
    description: "Run a Laravel artisan command. Returns stdout and stderr.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "The artisan command to run (e.g. 'migrate', 'route:list', 'make:model Foo')" },
      },
      required: ["command"],
    },
  },
  {
    name: "migrateStatus",
    description: "Show the status of Laravel migrations. Lists which migrations have been run and which are pending.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "envInfo",
    description: "Show Laravel environment info: APP_ENV, APP_DEBUG, and database connection status.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "cache",
    description: "Manage Laravel caches: clear all caches, or cache config/routes for performance.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["clear", "configCache", "configClear", "routeCache", "routeClear", "viewClear"],
          description: "The cache operation to perform",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "configGet",
    description: "Get a Laravel config value by key (e.g. 'app.name', 'database.default', 'mail.default').",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "The config key in dot notation (e.g. 'app.timezone')" },
      },
      required: ["key"],
    },
  },
  {
    name: "schema",
    description: "Inspect the Laravel database schema: list all tables, or show column details for a specific table.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["tables", "columns"],
          description: "Whether to list all tables or show columns of a specific table",
        },
        table: {
          type: "string",
          description: "Table name (required when action is 'columns')",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "model",
    description: "List Eloquent models in the Laravel application by scanning app/Models and verifying they extend Model.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "log",
    description: "View recent entries from the Laravel log file (storage/logs/laravel.log).",
    inputSchema: {
      type: "object",
      properties: {
        lines: {
          type: "number",
          description: "Number of recent lines to show (default: 100)",
        },
      },
      required: [],
    },
  },
  {
    name: "routeList",
    description: "List Laravel routes with optional filtering by name or URI",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Filter by route name (e.g. 'notes')" },
        uri: { type: "string", description: "Filter by URI pattern (e.g. '/notes')" },
        method: {
          type: "string",
          enum: ["GET", "POST", "PUT", "DELETE"],
          description: "Filter by HTTP method",
        },
      },
      required: [],
    },
  },
  {
    name: "runTest",
    description: "Run PHPUnit tests with optional filter",
    inputSchema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          description: "Test name or class filter (e.g. 'PostTest' or 'test_it_can_create_post')",
        },
      },
      required: [],
    },
  },
  {
    name: "envInfoSafe",
    description: "Read Laravel environment info, filtering out sensitive values (keys, passwords, tokens)",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "frontendScanner",
    description: "Scan Laravel frontend structure: views, JS, CSS files",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
]

export const toolHandlers: Record<string, ToolHandler> = {
  artisan: executeArtisan,
  migrateStatus: executeMigrateStatus,
  envInfo: executeEnvInfo,
  cache: executeCache,
  configGet: executeConfigGet,
  schema: executeSchema,
  model: executeModel,
  log: executeLog,
  routeList: executeRouteList,
  runTest: executeRunTest,
  envInfoSafe: executeEnvInfoSafe,
  frontendScanner: executeFrontendScanner,
}

export function handleToolCall(name: string, args: Record<string, unknown>) {
  const handler = toolHandlers[name]
  if (!handler) {
    return {
      content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
      isError: true as const,
    }
  }
  return handler(args)
}
