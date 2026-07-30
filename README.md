# Laravel MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that exposes Laravel development tools as standard MCP tools. Works with any MCP-compatible client: **Claude Desktop, Cursor, Codex, OpenCode**, and more.

## Tools

| Tool | Description |
|------|-------------|
| `artisan` | Run any `php artisan` command |
| `migrateStatus` | Check migration status |
| `envInfo` | Display APP_ENV, APP_DEBUG, DB connection |
| `cache` | Clear/cache config, routes, views |
| `configGet` | Inspect config values by key |
| `schema` | List database tables, view column definitions |
| `model` | Scan Eloquent models in `app/Models` |
| `log` | Tail the Laravel log file |

## Usage

### With OpenCode

Add to `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "mcpServers": {
    "laravel": {
      "type": "local",
      "command": ["npx", "tsx", "/path/to/laravel-mcp-server/src/index.ts"]
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
      "command": "npx",
      "args": ["tsx", "/path/to/laravel-mcp-server/src/index.ts"]
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
npm run typecheck
npm start
```

## License

MIT
