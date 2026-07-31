# API Reference

全部工具均通过 MCP 协议调用。返回格式统一为 `{ content: [{ type: "text", text }], isError? }`，其中 `text` 为 JSON 字符串或表格文本。

## 通用返回格式

成功时 `isError` 缺省或为 `false`，`content[0].text` 为结果文本。

失败时 `isError: true`，`content[0].text` 形如 `Error: <message>`。

## Tools

### artisan

- 描述: 运行任意白名单内 artisan 命令（返回 stdout + stderr）
- 参数: `{ command: string }`（`command` 必填）
- 返回: 命令原始输出文本；若命令不在白名单或包含危险片段，返回错误。危险命令（`db:wipe`、`tinker` 等）被黑名单拦截。

### migrateStatus

- 描述: 展示迁移状态（已运行 / 待运行）
- 参数: `{}`
- 返回: `php artisan migrate:status` 表格文本

### envInfo

- 描述: 显示 APP_ENV、APP_DEBUG、数据库连接状态
- 参数: `{}`
- 返回: JSON 文本 `{ appEnv, appDebug, database, ... }`

### cache

- 描述: 管理 Laravel 缓存：清空全部缓存，或缓存/清除 config、routes、views
- 参数: `{ action: "clear" | "configCache" | "configClear" | "routeCache" | "routeClear" | "viewClear" }`
- 返回: 操作结果文本

### configGet

- 描述: 按 key 读取 config 值
- 参数: `{ key: string }`（点分记法，如 `app.name`、`database.default`、`mail.default`）
- 返回: JSON 文本 `{ key, value }`

### schema

- 描述: 检查数据库结构：列出所有表，或查看某张表的列定义
- 参数: `{ action: "tables" | "columns", table?: string }`（`action` 必填；`action=columns` 时 `table` 必填）
- 返回: 表清单或列定义（列名、类型、可空、默认值等）表格

### model

- 描述: 扫描 `app/Models` 下继承 Eloquent `Model` 的模型
- 参数: `{}`
- 返回: JSON 数组文本 `[ { name, file }, ... ]`

### log

- 描述: 查看最近日志条目（`storage/logs/laravel.log`）
- 参数: `{ lines?: number }`（默认 100）
- 返回: 最近日志行文本

### routeList

- 描述: 查询路由，支持按 name / uri / method 过滤
- 参数: `{ name?, uri?, method?: "GET" | "POST" | "PUT" | "DELETE" }`
- 返回: 路由数组（`{ method, uri, name, action }`）或表格文本

### runTest

- 描述: 运行 PHPUnit 测试，支持过滤
- 参数: `{ filter?: string }`（如 `PostTest` 或 `test_it_can_create_post`）
- 返回: `php artisan test` 输出文本

### envInfoSafe

- 描述: 读取环境信息，过滤敏感值（密钥、密码、token 等被脱敏为 `***`）
- 参数: `{}`
- 返回: JSON 文本，敏感字段已脱敏

### frontendScanner

- 描述: 扫描前端结构（`resources/views`、js、css 文件）
- 参数: `{}`
- 返回: JSON 文本 `{ views: [...], js: [...], css: [...], ... }`

### makeModel

- 描述: 创建新的 Eloquent 模型类
- 参数: `{ name: string, migration?: boolean, factory?: boolean, seed?: boolean }`
- 返回: 创建结果（生成的文件路径）

### makeController

- 描述: 创建控制器类
- 参数: `{ name: string, resource?: boolean, model?: string, api?: boolean }`
- 返回: 创建结果（生成的文件路径）

### makeMigration

- 描述: 创建新的迁移文件
- 参数: `{ name: string, table?: string, create?: boolean }`
- 返回: 创建结果（生成的迁移文件路径）

### migrationAnalyzer

- 描述: 解析迁移文件并提取数据库结构（列、类型、外键）
- 参数: `{}`
- 返回: JSON 文本 `{ migrations: [...], tables: [...], columns: [...], foreignKeys: [...] }`

### composerAnalyzer

- 描述: 列出项目依赖（来自 composer.json / composer.lock）
- 参数: `{ filter?: string, dev?: boolean }`（`dev` 默认 false）
- 返回: JSON 文本 `{ packages: [ { name, version, ... } ] }`

### projectContext

- 描述: 获取全面的项目上下文（Laravel 版本、模型、路由、包、结构），支持模块化缓存（按文件 mtime 失效）
- 参数: `{ force?: boolean }`
- 返回: JSON 文本，结构见下
- 返回结构:

```jsonc
{
  "laravel": { "version": "11.x", "phpVersion": "8.3", "environment": "local", "debug": true, "database": { "driver": "mysql", "name": "blog" }, "framework": "Laravel" },
  "app": { "name": "Blog", "url": "http://localhost" },
  "models": ["Post", "User"],
  "tables": ["posts", "users"],
  "routes": { "count": 5, "named": [], "groups": [] },
  "packages": { "production": ["laravel/framework"], "dev": [] },
  "frontend": ["resources/views/..."],
  "structure": { "controllers": 3, "views": 4, "migrations": 5, "tests": 2 },
  "builtAt": 1750000000000,
  "source": "cache"  // "cache" | "fresh"
}
```

## Workflows

工作流为多步骤操作，均会持久化运行记录到 `<project>/.mcp/runs/<runId>.json`，返回包含 `runId` 与 `runStatus`。

### crudGenerator

- 流程: migration → model → controller → request → route → test
- 参数: `{ entity: string, table?: string, fields?: string }`
  - `fields` 形如 `title:string,content:text,user_id:foreignId`
- 返回: `{ steps, testOutput, summary, runId, runStatus }`
  - `steps`: `[{ step, name, status: "done"|"failed"|..., detail? }]`
  - `runStatus`: `"running" | "success" | "failed"`

### createFeature

- 描述: 生成完整 Laravel 功能（在 CRUD 基础上额外生成 Blade 视图）
- 流程: migration → model → controller → request → routes → views → test
- 参数: `{ entity: string, fields?: string, views?: boolean, api?: boolean }`
  - `views` 默认 `true`，`api` 默认 `false`（`api: true` 时生成 API 控制器）
- 返回: `{ steps, testOutput, summary, runId, runStatus }`

### debugWorkflow

- 描述: 定位错误文件 → 读取上下文 → 诊断常见问题 → 给出修复建议
- 流程: locate → analyze → diagnose → suggest
- 参数: `{ error: string, file?: string }`（`error` 必填，可传错误消息或堆栈）
- 返回: `{ error, report, steps, runId, runStatus }`，`report` 为诊断建议文本

### apiGenerator

- 描述: 生成 REST API（migration → model → API controller → request → api route → test）
- 参数: `{ entity: string, fields?: string, auth?: boolean }`（`auth` 默认 false，为 true 时路由加 `auth:sanctum` 中间件）
- 返回: `{ steps, testOutput, summary, runId, runStatus }`

## Planner

### intentPlanner

- 描述: 解析自然语言开发请求为意图 + 计划，可 dryRun 或直接执行
- 参数: `{ request: string, dryRun?: boolean }`（`dryRun` 默认 `true`）
- 支持意图: `create_feature` / `create_crud` / `create_api` / `add_relation` / `add_policy` / `add_test` / `debug`
- 返回:

```jsonc
// dryRun: true（默认）
{ "mode": "plan", "intent": { action, entity, fields, options, confidence, raw }, "plan": { intent, steps: [{ step, type, action, params, optional?, dependsOn? }], summary } }

// dryRun: false 且成功执行
{ "mode": "executed", "intent": {...}, "plan": {...}, "executed": {...} }
```

## 其他

### workflowStatus (list/get/resume/rollback)

- 描述: 管理工作流运行记录：列出、查看、继续执行、回滚
- 参数: `{ action?: "list" | "get" | "resume" | "rollback", runId?: string }`（`action` 默认 `list`；`get`/`resume`/`rollback` 需 `runId`）
- 返回:
  - `list`: `{ action: "list", runs: [{ id, workflow, entity, status, startedAt, updatedAt, stepsDone, stepsFailed, artifacts }] }`
  - `get`: `{ action: "get", run: { id, workflow, entity, args, startedAt, updatedAt, status, steps, artifacts } }`
  - `resume`: 重新执行该 run（跳过已成功步骤），返回工作流结果
  - `rollback`: 删除该 run 产生的 artifacts，并标记 `status: "rolled_back"`，返回 `{ action, runId, status, removedArtifacts }`
- 约束: `resume` 对 `status: "success"` 或 `"rolled_back"` 的 run 会返回错误；`rollback` 对不存在的 run 返回错误。

### Context Resource

- URI: `laravel://context`（若启用），返回与 `projectContext` 相同的项目上下文 JSON。
- 支持按文件 mtime 的模块化缓存失效：任一被跟踪文件（`artisan`、`.env`、`composer.json`、`app/Models/**/*.php`、`routes/*.php`、`database/migrations/*.php` 等）变更后自动重建对应模块。

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `LARAVEL_PROJECT_PATH` | `process.cwd()` | Laravel 项目路径 |
| `PHP_PATH` | `php` | PHP 可执行文件路径 |

### 安全机制

- 命令白名单：`artisan` 仅允许白名单内的命令。
- 危险命令黑名单：`db:wipe`、`tinker` 等被拒绝。
- `envInfoSafe` 对密钥 / 密码 / token 做脱敏（`***`）。
