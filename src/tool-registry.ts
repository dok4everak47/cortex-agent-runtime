/**
 * Central registry for tool definitions and handlers.
 * Extracted so that tests can validate tool registration without
 * needing to import the top-level server or mock the SDK.
 */
import { getLogger } from "./mcp.js"
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
import { executeMakeModel } from "./tools/make-model.js"
import { executeMakeController } from "./tools/make-controller.js"
import { executeMakeMigration } from "./tools/make-migration.js"
import { executeMigrationAnalyzer } from "./tools/migration-analyzer.js"
import { executeComposerAnalyzer } from "./tools/composer-analyzer.js"
import {
  executeCrudGenerator,
  executeCreateFeature,
  executeDebugWorkflow,
  executeApiGenerator,
} from "./workflows/index.js"
import { executeProjectContext } from "./tools/project-context.js"
import { executeWorkflowStatus } from "./tools/workflow-status.js"
import { handleIntentPlanner } from "./planner/index.js"

export type ToolHandler = (args: Record<string, unknown>) => ToolResult | Promise<ToolResult>

export type ToolResult = {
  content: { type: "text"; text: string }[]
  isError?: boolean
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
  {
    name: "makeModel",
    description: "Create a new Eloquent model class",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Model class name (e.g. 'Post', 'User')" },
        migration: { type: "boolean", description: "Create migration file" },
        factory: { type: "boolean", description: "Create factory class" },
        seed: { type: "boolean", description: "Create seeder class" },
      },
      required: ["name"],
    },
  },
  {
    name: "makeController",
    description: "Create a new controller class",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Controller name (e.g. 'PostController')" },
        resource: { type: "boolean", description: "Generate resource controller with CRUD methods" },
        model: { type: "string", description: "Bind to a model for resource controller" },
        api: { type: "boolean", description: "Generate API controller (excludes web methods)" },
      },
      required: ["name"],
    },
  },
  {
    name: "makeMigration",
    description: "Create a new migration file",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Migration name (e.g. 'create_posts_table')" },
        table: { type: "string", description: "Table name for create/update operations" },
        create: { type: "boolean", description: "Create the table" },
      },
      required: ["name"],
    },
  },
  {
    name: "migrationAnalyzer",
    description: "Parse Laravel migration files and extract database schema (columns, types, foreign keys)",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "composerAnalyzer",
    description: "List Laravel project dependencies from composer.json and composer.lock",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Filter by package name (partial match, e.g. 'laravel', 'spatie')" },
        dev: { type: "boolean", description: "Include dev dependencies (default: false)" },
      },
      required: [],
    },
  },
  {
    name: "crudGenerator",
    description: "Generate full CRUD for a Laravel entity: migration, model, controller, request, route, test, and run tests",
    inputSchema: {
      type: "object",
      properties: {
        entity: { type: "string", description: "Entity name in singular (e.g. 'Post', 'Category')" },
        table: { type: "string", description: "Table name (optional, defaults to snake_plural of entity)" },
        fields: { type: "string", description: "Optional comma-separated field definitions (e.g. 'title:string,content:text,user_id:foreignId')" },
      },
      required: ["entity"],
    },
  },
  {
    name: "createFeature",
    description: "Generate complete Laravel feature: migration, model, controller, requests, routes, blade views, tests",
    inputSchema: {
      type: "object",
      properties: {
        entity: { type: "string", description: "Entity name in singular (e.g. 'Post', 'Category')" },
        fields: { type: "string", description: "Comma-separated field definitions (e.g. 'title:string,content:text')" },
        views: { type: "boolean", default: true, description: "Whether to generate Blade views (default: true)" },
        api: { type: "boolean", default: false, description: "Generate an API controller instead of web controller (default: false)" },
      },
      required: ["entity"],
    },
  },
  {
    name: "debugWorkflow",
    description: "Analyze a Laravel error: locate file, read context, diagnose common issues, suggest fixes",
    inputSchema: {
      type: "object",
      properties: {
        error: { type: "string", description: "Error message or stack trace" },
        file: { type: "string", description: "Optional: specific file to analyze" },
      },
      required: ["error"],
    },
  },
  {
    name: "apiGenerator",
    description: "Generate REST API for a Laravel entity: migration, model, API controller, routes, tests",
    inputSchema: {
      type: "object",
      properties: {
        entity: { type: "string", description: "Entity name in singular (e.g. 'Post', 'Category')" },
        fields: { type: "string", description: "Comma-separated field definitions (e.g. 'title:string,content:text')" },
        auth: { type: "boolean", default: false, description: "Protect routes with auth:sanctum middleware" },
      },
      required: ["entity"],
    },
  },
  {
    name: "projectContext",
    description: "Get comprehensive Laravel project context (version, models, routes, packages, structure)",
    inputSchema: {
      type: "object",
      properties: {
        force: { type: "boolean", description: "Force rebuild instead of using cache" },
      },
      required: [],
    },
  },
  {
    name: "intentPlanner",
    description: "Parse a natural language development request, generate an execution plan, and optionally execute it (execution requires confirmed=true)",
    inputSchema: {
      type: "object",
      properties: {
        request: { type: "string", description: "Natural language request (e.g. '给博客增加评论功能')" },
        dryRun: { type: "boolean", default: true, description: "If true, only show the plan without executing (default: true)" },
        confirmed: { type: "boolean", description: "If true (and dryRun=false), the plan has been reviewed and will be executed" },
      },
      required: ["request"],
    },
  },
  {
    name: "workflowStatus",
    description: "List workflow runs, inspect a run, resume or rollback",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "get", "resume", "rollback"], default: "list", description: "Operation to perform (default: list)" },
        runId: { type: "string", description: "Run ID (required for get/resume/rollback)" },
      },
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
  makeModel: executeMakeModel,
  makeController: executeMakeController,
  makeMigration: executeMakeMigration,
  migrationAnalyzer: executeMigrationAnalyzer,
  composerAnalyzer: executeComposerAnalyzer,
  crudGenerator: executeCrudGenerator,
  createFeature: executeCreateFeature,
  debugWorkflow: executeDebugWorkflow,
  apiGenerator: executeApiGenerator,
  projectContext: executeProjectContext,
  intentPlanner: handleIntentPlanner,
  workflowStatus: executeWorkflowStatus,
}

export async function handleToolCall(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const logger = getLogger()
  const handler = toolHandlers[name]
  if (!handler) {
    logger.warn("tool not found", { name })
    return {
      content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
      isError: true as const,
    }
  }

  logger.info("tool called", { name, args })
  const start = performance.now()

  try {
    const result = await handler(args)
    const durationMs = (performance.now() - start).toFixed(1)
    logger.info("tool completed", { name, durationMs })
    return result
  } catch (err) {
    const durationMs = (performance.now() - start).toFixed(1)
    const msg = err instanceof Error ? err.message : String(err)
    logger.error("tool failed", { name, durationMs, error: msg })
    return {
      content: [{ type: "text" as const, text: `Error: ${msg}` }],
      isError: true as const,
    }
  }
}
