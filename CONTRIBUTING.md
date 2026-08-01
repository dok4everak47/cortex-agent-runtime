# Contributing

感谢你愿意为 cortex-agent-runtime 贡献代码。请先阅读本指南，确保你的改动符合项目的架构规范。

## 环境搭建

- Node.js 22+
- 一个本地的 Laravel 项目（用于 golden 测试与手动验证）

```bash
npm install
npx tsc --noEmit
npm test
```

## 架构规范

代码按 core + domains 双层分层：`core/` 是框架层（与项目类型无关），`domains/` 是具体项目域。新增功能前先确定它属于哪一层：

| 层 | 目录 | 说明 |
|----|------|------|
| 框架 | `src/core/` | `registry.ts`（ToolRegistry 域注册制）、`detector.ts`（项目类型检测）、`mcp.ts`/`logger.ts`（运行时）、`tool-helper.ts`、`glob.ts` |
| 域：Laravel | `src/domains/laravel/` | 原子工具 `tools/`、多步骤工作流 `workflows/`、上下文 `context/`、安全 `security/`、意图解析 `planner/`、域清单 `manifest.ts` |
| 域：Generic | `src/domains/generic/` | 任何项目都加载的通用工具（gitStatus/fileSearch/projectTree）、域清单 `manifest.ts` |

新增一个域时在 `src/core/registry.ts` 中 `registerDomain(manifest)`（`DomainManifest` 提供 `getTools()` + `getHandlers()`）。

## 新增一个 Tool

1. 在 `src/domains/<domain>/tools/xxx.ts` 导出 `executeXxx(args)`，返回 `{ content, isError? }`（可用 `success`/`failure` 助手，见 `src/core/tool-helper.ts`）
2. 在 `src/domains/<domain>/manifest.ts` 注册 `name` + handler（`TOOL_DEFINITIONS` 与 `toolHandlers`）
3. 在 `src/__tests__/xxx.test.ts` 写单元测试
4. 运行 `npx tsc --noEmit && npm test`

## 新增一个 Workflow

1. `src/domains/laravel/workflows/xxx/planner.ts` — 纯函数，输入参数生成 `{ steps, summary }`
2. `src/domains/laravel/workflows/xxx/steps/*.ts` — 每个 step 一个模块，导出 `run(step, ctx)`（参考 `src/domains/laravel/workflows/crud/steps/`）
3. `src/domains/laravel/workflows/xxx/executor.ts` — 组装 `runPlan`，负责持久化到 `.mcp/runs/`
4. 在 `src/domains/laravel/manifest.ts` 注册，并在 `src/domains/laravel/tools/workflow-status.ts` 的 `resumeRun` 中加入可恢复处理
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
