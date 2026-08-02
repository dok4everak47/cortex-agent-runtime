# TASK — Cortex orchestration domain 工具层（manifest + 只读工具）

## Value Statement

- **谁受益**: 接 Cortex MCP 的 agent（Claude/OpenCode/Cursor）——第一次能"看见"项目任务编排状态
- **解决什么**: 基础层（任务1）已有状态机/存储/审批/metrics 纯模块，但无 MCP 工具暴露——agent 无法调用
- **省多少时间**: agent 自己查任务状态/指标，不用人转述
- **改变什么行为**: 编排状态从"只有人能看"变为"agent 也能看"（任务3 再让它能推）

## Goal

把 orchestration 基础层暴露为 MCP 工具，注册进 domain 体系。
Before: agent 完全看不到 .htask 任务状态。After: taskStatus/taskMetrics/policyGet 三个只读工具可用。

## Context

- 基础层（任务1，已合并 fe8eca5）: src/domains/orchestration/{state/,metrics.ts}
  - state/task-store.ts: readTask/createTask/writeTask + state.json 指针
  - state/approval.ts: loadApprovalPolicy（分级）
  - metrics.ts: computeMetrics
- 注册模式:
  - src/core/detector.ts: detectDomains 显式列 domain（generic 常驻 + laravel 条件）——orchestration 加为常驻（同 generic）
  - src/domains/generic/manifest.ts: TOOL_DEFINITIONS + execute 函数映射（参考最简样例）
  - 工具风格: src/domains/generic/tools/file-search.ts（success/failure + getConfig().projectPath）
  - tool-helper: success(text) / failure(toolName, err)
- 数据源: projectPath/.htask/tasks/*.json + state.json + approval.yaml（与 htask 同构）

## Current Behavior

- orchestration 只有基础模块，无 manifest/tools，detector 不加载它
- agent 无法通过 MCP 查看任务状态

## Expected Behavior

- `taskStatus`: 列出所有任务（id/标题/状态/state/nextStep/stale/停留时长），JSON 文本；无任务返回 "(no tasks)"；--json 风格对齐 htask list
- `taskMetrics`: computeMetrics 结果文本报告（TTV 表 + 等待占比 + 瓶颈排序），缺数据任务标注 ⚠️
- `policyGet`: 审批策略来源（默认/file）+ high/low 分级 + approval.yaml 路径
- orchestration domain 在 detectDomains 常驻注册，tools/list 可见
- 全部工具走 success/failure，参数校验（如无 projectPath 或 .htask 缺失时友好错误）

## Design

- src/domains/orchestration/manifest.ts: DomainManifest
  - id='orchestration', name, description（中文描述对齐现有风格）
  - detect: 返回 true（常驻，任务编排对任何项目有意义）
  - getTools: 3 个 ToolDefinition（taskStatus/taskMetrics/policyGet，含 inputSchema）
  - getHandlers: 映射到 execute 函数
- src/domains/orchestration/tools/task-status.ts: executeTaskStatus（读 task-store → 格式化列表；无 .htask 返回友好提示）
- src/domains/orchestration/tools/task-metrics.ts: executeTaskMetrics（computeMetrics → 文本报告）
- src/domains/orchestration/tools/policy-get.ts: executePolicyGet（loadApprovalPolicy → 展示）
- src/core/detector.ts: import orchestrationDomain，push 到 domains（常驻，顺序 generic → orchestration → laravel?）
- 格式化: 文本表格对齐 htask list 风格；全部用 success/failure

## Files

- 新增: src/domains/orchestration/manifest.ts
- 新增: src/domains/orchestration/tools/task-status.ts
- 新增: src/domains/orchestration/tools/task-metrics.ts
- 新增: src/domains/orchestration/tools/policy-get.ts
- 修改: src/core/detector.ts（注册 orchestration）
- 新增: src/__tests__/orchestration-tools.test.ts（工具层测试）

## Constraints

- 不引新依赖
- 不修改基础层模块（state/metrics 只 import）
- 不实现写工具（taskAccept/taskAdvance 是任务3）
- 工具名 camelCase（taskStatus/taskMetrics/policyGet）
- 文本输出对齐现有工具风格（纯文本，JSON 序列化用 JSON.stringify(x, null, 2)）

## Acceptance Criteria

- taskStatus 在有任务数据时列出全部任务 + 状态摘要；无 .htask 时不 crash 返回提示
- taskMetrics 输出包含 等待占比 + 瓶颈排序；缺数据任务标注
- policyGet 输出 来源 + 分级规则
- detector 注册后 tools/list 包含 3 个 orchestration 工具
- 单测 ≥ 8 个（每工具 2-3 场景：正常/空/缺数据/异常）
- 全部测试通过（331 + 新增）+ typecheck

## Verification Commands

```bash
npm test
npm run typecheck
# 冒烟: 起 MCP server 或直接调用 execute 函数验证
```

## Rollback Plan

- git revert <commit>（新增文件 + detector 一行）
