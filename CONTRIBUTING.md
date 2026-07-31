# Contributing

感谢你愿意为 laravel-mcp-server 贡献代码。请先阅读本指南，确保你的改动符合项目的架构规范。

## 环境搭建

- Node.js 22+
- 一个本地的 Laravel 项目（用于 golden 测试与手动验证）

```bash
npm install
npx tsc --noEmit
npm test
```

## 架构规范

代码按职责分层，新增功能前先确定它属于哪一层：

| 层 | 目录 | 说明 |
|----|------|------|
| 原子能力 | `src/tools/` | 单文件、纯函数风格，一个工具一个文件，导出 `executeXxx` |
| 多步骤 | `src/workflows/<name>/` | planner + executor + `steps/`，每个 step 一个文件 |
| 意图解析 | `src/planner/` | 自然语言 → 意图 + 计划 |
| 安全 | `src/security/` | 命令白名单/黑名单、敏感信息脱敏、操作策略 |
| 上下文 | `src/context/` | 模块化缓存、项目上下文构建 |

## 新增一个 Tool

1. 在 `src/tools/xxx.ts` 导出 `executeXxx(args)`，返回 `{ content, isError? }`（可用 `success`/`failure` 助手，见 `src/tool-helper.ts`）
2. 在 `src/tool-registry.ts` 注册 `name` + handler（`TOOL_DEFINITIONS` 与 `toolHandlers`）
3. 在 `src/__tests__/xxx.test.ts` 写单元测试
4. 运行 `npx tsc --noEmit && npm test`

## 新增一个 Workflow

1. `src/workflows/xxx/planner.ts` — 纯函数，输入参数生成 `{ steps, summary }`
2. `src/workflows/xxx/steps/*.ts` — 每个 step 一个模块，导出 `run(step, ctx)`（参考 `src/workflows/crud/steps/`）
3. `src/workflows/xxx/executor.ts` — 组装 `runPlan`，负责持久化到 `.mcp/runs/`
4. 在 `src/tool-registry.ts` 注册，并在 `src/tools/workflow-status.ts` 的 `resumeRun` 中加入可恢复处理
5. 写测试 + golden scenario（`src/__tests__/golden/scenarios.ts`）

## 测试

- 单元: `npx tsx --test src/__tests__/*.test.ts`
- Golden: `npx tsx --test src/__tests__/golden/golden.test.ts`（需真实 Laravel 项目，通过 `LARAVEL_PROJECT_PATH` 指向）
- 类型检查: `npx tsc --noEmit`

## PR 流程

1. fork 本仓库并创建 feature branch
2. 遵循架构规范，保持改动聚焦
3. 确保测试全绿（类型检查 + 单元测试 + 相关 golden）
4. 提交 PR，描述中写明：改动内容 + 验证方式
