# TASK — Cortex 新增 toolStats 工具（工具调用统计）

## Goal

让外部 agent 能查看本项目所有 MCP 工具的调用统计（调用次数 / 平均耗时 / 最近调用时间）。

Before: agent 想知道"哪个工具最慢/最常用"只能翻日志。
After: 调用 `toolStats` 一次拿到全部工具的统计 JSON。

## Context

- 项目: ~/Project/cortex-agent-runtime（MCP-native AI Agent Framework, TypeScript）
- `src/core/registry.ts` 的 `ToolRegistry.callTool()` 已有 `performance.now()` 计时 + `logger.info("tool called", {name, args})` 日志，但统计不保留。
- 工具注册机制: domain manifest 的 `TOOL_DEFINITIONS` + `toolHandlers`，generic/laravel 两个 domain 都有 manifest。
- 现有测试: 288 个全绿（node:test, `npm test`）。

## Current Behavior

- `callTool()` 每次调用只打日志，统计信息即用即弃。
- 没有暴露工具调用统计的 MCP 工具。

## Expected Behavior

- 新增 MCP 工具 `toolStats`（generic domain，所有项目可用）：
  - 输入: `{}`（或 `{ reset: true }` 清零统计）
  - 输出: JSON `{ tools: [{ name, calls, avgDurationMs, lastCalledAt }], totalCalls }`
- 统计数据从 `ToolRegistry` 收集（registry 内部维护 per-tool 计数器），不引入新依赖。

## Design

1. **`src/core/registry.ts`**:
   - `ToolRegistry` 增加私有统计 Map: `stats: Map<string, { calls: number, totalMs: number, lastCalledAt: number }>`
   - `callTool()` 内每次调用更新: calls++ / totalMs += duration / lastCalledAt = Date.now()
   - 新增方法 `getToolStats(): { tools: Array<{name, calls, avgDurationMs, lastCalledAt}>, totalCalls }`（平均耗时 = totalMs/calls，保留 1 位小数）
   - 新增方法 `resetToolStats(): void`
2. **`src/core/tools/tool-stats.ts`**（新文件）:
   - `executeToolStats(args): ToolResult` — 读 registry 统计，`reset` 时清零，返回 JSON
   - 用现有 `success`/`failure` helper（从 `../tool-helper.js` import）
3. **`src/domains/generic/manifest.ts`**:
   - `TOOL_DEFINITIONS` 增加 `toolStats` 定义（name/description/inputSchema: `reset` 可选 boolean）
   - `toolHandlers` 增加 `toolStats: executeToolStats`
4. 不修改 laravel domain、不修改任何现有工具行为。

## Files

- 修改: `src/core/registry.ts`、`src/domains/generic/manifest.ts`
- 新增: `src/core/tools/tool-stats.ts`、`src/__tests__/tool-stats.test.ts`

## Constraints

- 不引入新依赖；TypeScript 严格模式；类型跟随现有风格（`ToolResult` 等）
- 向后兼容: `callTool()` 行为不变，只是内部多记账；不改变任何现有工具名/参数
- 测试用 mock 的 registry 实例（不依赖真实 MCP 启动）
- 中文注释风格与现有代码一致

## Acceptance Criteria

1. `npm run typecheck` 通过
2. `npm test` 全绿（新增 tool-stats 测试: 调用计数、平均耗时、reset、未调用工具不在列表或 calls=0）
3. tools/list 中出现 `toolStats`
4. 调用 `toolStats` 返回合法 JSON，含 tools 数组和 totalCalls
5. 现有 288 测试不回归

## Verification Commands

```bash
npm run typecheck
npm test
npm run build
```

## Rollback Plan

- `git revert` 该 commit；或删除 `src/core/tools/tool-stats.ts` + 还原 registry.ts/manifest.ts 改动
