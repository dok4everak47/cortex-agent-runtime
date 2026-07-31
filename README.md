# Laravel AI Development Agent

**An MCP-powered autonomous development toolkit for Laravel projects.**

Give Claude / OpenCode / Cursor a **Laravel engineering brain**.

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that makes your AI coding agent understand, generate and debug Laravel applications. Works with any MCP-compatible client: **Claude Desktop, Cursor, Codex, OpenCode**, and more.

## Features

✅ **Understand Laravel project structure** — models, routes, migrations, packages, frontend — injected automatically

✅ **Generate complete features** — from a natural-language request to working CRUD, Blade views, and REST APIs

✅ **Debug exceptions** — locate the file, diagnose common Laravel errors, suggest fixes

✅ **Generate REST APIs** — migration, model, API controller, Sanctum-protected routes, tests

✅ **Analyze database** — schema, tables, columns, migrations, relationships

✅ **Safe Artisan execution** — command whitelist, dangerous commands blocked, sensitive data redacted

## Demo

Once connected, ask your AI agent in any MCP-compatible client:

```
> Add a comment feature to the blog
→ intentPlanner: parsed as create_feature/Comment
→ createFeature: migration → model → controller → request → views → test
→ workflowStatus: run persisted to .mcp/runs/

> List the routes
→ routeList: 47 routes, filterable by name

> SQLSTATE[42P01] Table not found — how to fix?
→ debugWorkflow: locate + diagnose + suggest fixes
```

## Tools

| Tool | Description |
|------|-------------|
| `artisan` | Run any `php artisan` command (whitelist restricted) |
| `migrateStatus` | Check migration status |
| `envInfo` | Display APP_ENV, APP_DEBUG, DB connection |
| `cache` | Clear/cache config, routes, views |
| `configGet` | Inspect config values by key |
| `schema` | List database tables, view column definitions |
| `model` | Scan Eloquent models in `app/Models` |
| `log` | Tail the Laravel log file |
| `routeList` | List routes with optional name/URI/method filter |
| `runTest` | Run PHPUnit tests with optional filter |
| `envInfoSafe` | Read .env filtering out sensitive values |
| `frontendScanner` | Scan resources/views, js, css structure |
| `makeModel` | Create a new Eloquent model with optional migration/factory |
| `makeController` | Create a controller with optional resource/api/model binding |
| `makeMigration` | Create a new migration file |
| `migrationAnalyzer` | Parse migrations and extract schema (columns, types, FKs) |
| `composerAnalyzer` | List project dependencies with version info |
| `projectContext` | Get comprehensive project context (version, models, routes, packages) |
| `crudGenerator` | Generate full CRUD: migration, model, controller, request, route, test |
| `createFeature` | Generate full feature: CRUD + Blade views |
| `apiGenerator` | Generate REST API: migration, model, API controller, routes, tests |
| `debugWorkflow` | Analyze an error: locate, diagnose, suggest fixes |
| `intentPlanner` | Parse a natural-language dev request into an executable plan |
| `workflowStatus` | List/inspect/resume/rollback workflow runs |

## Usage

### Installation

```bash
# From npm (demo version)
npm install laravel-ai-agent@beta

# From GitHub (demo version)
npm install github:dok4everak47/laravel-ai-agent
```

### With OpenCode

Add to `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "mcpServers": {
    "laravel": {
      "type": "local",
      "command": ["node", "/path/to/laravel-ai-agent/dist/index.js"]
    }
  }
}
```

### With Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "laravel": {
      "command": "node",
      "args": ["/path/to/laravel-ai-agent/dist/index.js"]
    }
  }
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LARAVEL_PROJECT_PATH` | `process.cwd()` | Path to Laravel project |
| `PHP_PATH` | `php` | PHP executable path |

## Requirements

- Node.js 18+
- PHP 8.1+ (for Laravel project interaction)
- A Laravel project with `artisan` in its root

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit (type-check only)
npm test            # run all tests
npm run build       # compile to dist/
npm start           # node dist/index.js
npm run dev         # npx tsx src/index.ts (hot reload)
```

## Security Model

✓ **Local only** — runs entirely on your machine, no server component
✓ **No telemetry** — sends zero usage data
✓ **No external API** — no network calls, works offline
✓ **Command whitelist** — artisan restricted to safe commands
✓ **Dangerous commands blocked** — db:wipe, migrate:fresh, tinker, shell
✓ **Sensitive data redaction** — .env values filtered before returning

See [SECURITY.md](./SECURITY.md) for details.

## License

MIT
