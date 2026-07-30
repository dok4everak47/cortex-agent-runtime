# Sprint 3-4: 剩余任务

## 1. MCP 服务测试

在 `src/tools/` 下为每个 tool 写测试文件，使用 Node.js 内置测试框架（node:test + assert）：

```
src/tools/
├── artisan.test.ts   测试白名单拒绝 + 放行 + 命令执行
├── route-list.test.ts 测试过滤逻辑（name/uri/method）
├── run-test.test.ts   测试命令拼接
├── mcp.test.ts        测试 MCP JSON-RPC 接口（tools/list + tools/call）
```

示例：

```typescript
import { describe, it } from "node:test"
import assert from "node:assert"

// 不需要实际调用 PHP，只测试白名单和参数处理
```

用 `mock` 替换 execSync，避免测试时真的跑 php。

运行：

```bash
npx tsx --test src/tools/*.test.ts
```

## 2. envInfoSafe 工具

新增 `src/tools/env-info-safe.ts`，读取 .env 文件但过滤敏感字段。

```typescript
{
  name: "envInfoSafe",
  description: "Read Laravel environment info, filtering out sensitive values (keys, passwords, tokens)",
  inputSchema: {
    type: "object",
    properties: {},
  },
}
```

实现逻辑：
1. 读取项目目录下的 `.env` 文件
2. 过滤掉包含以下 key 的行：APP_KEY, DB_PASSWORD, _TOKEN, _SECRET, _KEY, PASSWORD, SECRET
3. 返回过滤后的配置文件内容

## 3. Frontend Scanner 工具

新增 `src/tools/frontend-scanner.ts`，扫描 `resources/` 目录结构。

```typescript
{
  name: "frontendScanner",
  description: "Scan Laravel frontend structure: views, JS, CSS files",
  inputSchema: { type: "object", properties: {} },
}
```

输出格式：

```
Views:
  notes/
    index.blade.php
    show.blade.php
  dashboard/
    index.blade.php
JS:
  app.js
CSS:
  app.css
```

## 4. 架构重构

按功能模块重组目录：

```
src/
├── index.ts              ← 入口，只有 MCP server 初始化 + 工具注册
├── mcp.ts                ← 基础工具函数（exec, artisan, tinker）
├── tools/
│   ├── artisan.ts        ← 原 artisan 工具 + 白名单
│   ├── route-list.ts     ← 已有
│   ├── run-test.ts       ← 已有
│   ├── env-info-safe.ts  ← 新建
│   └── frontend-scanner.ts ← 新建
├── __tests__/            ← 测试放在统一目录
│   ├── artisan.test.ts
│   ├── route-list.test.ts
│   └── mcp.test.ts
```

所有已有工具的注册在 index.ts 中更新。

## 验证

```bash
cd /Users/dok4ever/Project/laravel-mcp-server

# 测试
npx tsx --test src/__tests__/*.test.ts

# 类型检查
npx tsc --noEmit

# 启动测试
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"envInfoSafe","arguments":{}}}' | LARAVEL_PROJECT_PATH=/path/to/blog npx tsx src/index.ts
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"frontendScanner","arguments":{}}}' | LARAVEL_PROJECT_PATH=/path/to/blog npx tsx src/index.ts
```
