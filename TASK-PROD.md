# 产品化改造

## 1. 补测试覆盖

给剩余的 12 个工具写测试：

| 工具 | 测试要点 |
|------|---------|
| schema | 解析 output（mock execSync） |
| model | 解析 tinker 输出 |
| cache | 参数拼接 + 空输出 fallback |
| config-get | 参数拼接 + 空值返回 |
| log | 参数拼接 |
| env-info | 多个 tinker 调用组合 |
| env-info-safe | 敏感字段过滤逻辑 |
| frontend-scanner | 目录扫描 + 树构建 |
| migrate-status | 解析 migration 列表 |
| make-model / make-controller / make-migration | 参数 flag 拼接 |

统一用 `node:test` + mock `execSync`。参考 `src/__tests__/artisan.test.ts` 的写法。

## 2. 抽公共 helper

新建 `src/tool-helper.ts`，把重复代码提取出来：

```typescript
import { getLogger } from "./mcp.js"
import type { ContentResult, TextContent } from "./mcp.js"

// 统一成功响应
export function success(text: string): { content: TextContent[] } {
  return { content: [{ type: "text", text }] }
}

// 统一错误响应 + 自动记日志
export function failure(toolName: string, err: unknown): { content: TextContent[], isError: true } {
  const msg = err instanceof Error ? err.message : String(err)
  getLogger().error(`${toolName} failed`, { error: msg })
  return {
    content: [{ type: "text", text: `Error: ${msg}` }],
    isError: true,
  }
}

// 统一 execSync 封装 + 日志
export function execSafe(cmd: string, cwd?: string): string { ... }
```

然后逐个工具替换 `try/catch` + `return {...}` 为 `success(text)` / `failure(name, err)`。

## 3. 确保纯 Node.js 可运行

当前所有 import 用 `.js` 后缀，依赖 tsx。改成：

1. 在 package.json 加 `"build": "tsc"` 编译到 dist/
2. 启动命令改成 `node dist/index.js`（而非 `npx tsx src/index.ts`）
3. README 更新启动方式

## 4. CI/CD

建 `.github/workflows/test.yml`：

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npx tsx --test src/__tests__/*.test.ts
```

## 验证

```bash
npm run typecheck     # tsc --noEmit
npm test              # tsx --test src/__tests__/*.test.ts
npm run build         # tsc -> dist/
node dist/index.js    # 纯 node 启动
```
