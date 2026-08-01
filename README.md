# Cortex Agent Runtime — MCP-native AI Agent Framework

**Before: AI doesn't understand your project. After: AI can analyze, generate and debug applications.**

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that turns any coding agent (Claude, Cursor, Codex, OpenCode, and more) into an autonomous engineering brain for the projects you work on. The runtime is **project-type agnostic**: it loads a set of *domains* based on what your project is, so the same runtime works across Laravel apps, Node projects, and anything else.

## Runtime

- **Project-type detection** — `core/detector.ts` inspects the project and activates the matching domains. Generic tools are always loaded; the Laravel domain activates when `composer.json` + `artisan` are present.
- **Domain registration** — `core/registry.ts` exposes `registerDomain(manifest)`; `listTools()` / `callTool()` stay stable so the MCP surface doesn't change between projects.
- **Safe by default** — local-only, offline, no telemetry. Command whitelists, dangerous-command blocking, and sensitive-data redaction are layered in.

## Built-in Domains

| Domain | When it loads | Tools |
|--------|---------------|-------|
| Generic | Always | `gitStatus`, `fileSearch`, `projectTree` |
| Laravel | `composer.json` + `artisan` exist | artisan, schema, model, routes, migrations, CRUD/feature/API generators, debug workflow, intentPlanner, workflowStatus, context, and more |

### Generic domain

| Tool | Description |
|------|-------------|
| `gitStatus` | Git status summary (branch, staged/unstaged changes) |
| `fileSearch` | Search files by glob, excluding `.git` / `node_modules` / `vendor` |
| `projectTree` | Two-level directory tree of the project |

### Laravel domain

| Tool | Description |
|------|-------------|
| `artisan` | Run whitelisted `php artisan` commands |
| `migrateStatus` | Migration status |
| `envInfo` / `envInfoSafe` | Environment info (safe variant redacts secrets) |
| `cache` | Clear/cache config, routes, views |
| `configGet` | Inspect config values |
| `schema` | List tables / columns |
| `model` | Scan Eloquent models |
| `log` | Recent log entries |
| `routeList` | Routes with name/URI/method filters |
| `runTest` | Run PHPUnit tests |
| `frontendScanner` | Scan views/js/css structure |
| `makeModel` / `makeController` / `makeMigration` | Scaffold classes |
| `migrationAnalyzer` | Parse migrations into schema |
| `composerAnalyzer` | Project dependencies |
| `projectContext` | Full project context (cached by file mtime) |
| `crudGenerator` | Full CRUD generator |
| `createFeature` | CRUD + Blade views |
| `apiGenerator` | REST API generator (optional Sanctum auth) |
| `debugWorkflow` | Error location, diagnosis, fix suggestions |
| `intentPlanner` | Natural-language request → executable plan |
| `workflowStatus` | List/inspect/resume/rollback runs |

## Quick Start

```bash
npm install
npm start
```

Set the project path to work against:

```bash
# Any project (Node, Laravel, ...)
CORTEX_PROJECT_PATH=/path/to/project npm start

# Laravel-specific path resolution (backward compatible)
LARAVEL_PROJECT_PATH=/path/to/laravel-app npm start

# Nothing set → process.cwd()
```

Run the server with a single MCP request to see which tools a project exposes:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | \
  CORTEX_PROJECT_PATH=/path/to/node-project npx tsx src/index.ts
# → only generic tools

echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | \
  CORTEX_PROJECT_PATH=/path/to/laravel-app npx tsx src/index.ts
# → generic + laravel tools
```

### With OpenCode

Add to `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "mcp": {
    "cortex": {
      "type": "local",
      "command": ["node", "/path/to/cortex-agent-runtime/dist/index.js"],
      "environment": { "CORTEX_PROJECT_PATH": "/path/to/project" }
    }
  }
}
```

### With Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cortex": {
      "command": "node",
      "args": ["/path/to/cortex-agent-runtime/dist/index.js"]
    }
  }
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CORTEX_PROJECT_PATH` | — | Project path (takes priority) |
| `LARAVEL_PROJECT_PATH` | `process.cwd()` | Backward-compatible Laravel project path |
| `PHP_PATH` | `php` | PHP executable path (Laravel domain) |
| `LLM_API_KEY` | *(empty)* | Enables the LLM semantic layer for `intentPlanner` |
| `LLM_BASE_URL` | `https://api.deepseek.com/v1` | OpenAI-compatible API base URL |
| `LLM_MODEL` | `deepseek-chat` | LLM model used for intent analysis |

## Architecture

```
src/
├── index.ts                 # entry: detect → load domains → register → start MCP
├── core/                    # framework layer — project-type agnostic
│   ├── registry.ts          # ToolRegistry: registerDomain / listTools / callTool
│   ├── mcp.ts               # getConfig / getLogger / runCommand
│   ├── logger.ts            # leveled logger
│   ├── detector.ts          # detectDomains(projectPath) → DomainManifest[]
│   ├── glob.ts              # minimal `*` / `**` glob
│   └── context/             # generic context interface
└── domains/
    ├── generic/             # always loaded: gitStatus / fileSearch / projectTree
    └── laravel/             # tools / workflows / context / security / planner / manifest
```

Each domain exports a `DomainManifest` (`id`, `name`, `detect`, `getTools`, `getHandlers`, `getProjectPath?`). The Laravel domain keeps its own runtime (`domains/laravel/mcp.ts`), tools, workflows, context, security, and planner — the pre-existing 24-tool surface is unchanged.

## Requirements

- Node.js 18+
- PHP 8.1+ (for the Laravel domain)

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit (type-check only)
npm test            # run all tests
npm run build       # compile to dist/
npm start           # node dist/index.js
npm run dev         # npx tsx src/index.ts (hot reload)
```

## License

MIT
