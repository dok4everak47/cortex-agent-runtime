# TASK — Cortex orchestration domain 基础层（htask 内核移植）

## Value Statement

- **谁受益**: 所有接 Cortex MCP 的 agent（Claude/OpenCode/Cursor）+ 你（双界面操作同一任务状态）
- **解决什么**: htask 编排内核是 JS 单体（hermes-task-runner/bin/htask.mjs），无法被 MCP agent 调用；Cortex 是 MCP-native 框架但没有任务编排能力
- **省多少时间**: agent 能直接查/推任务后，你从"手动告诉 agent 任务状态"中解放
- **改变什么行为**: 任务编排从"只有你能操作"变为"你和 agent 都能操作同一份状态"

## Goal

把 htask 的编排内核基础层移植为 Cortex 的 orchestration domain（TypeScript），存储格式与 htask 完全兼容。
Before: 状态机/存储/审批/metrics 都在 htask.mjs 单体里。After: Cortex 项目可 import 这些纯 TS 模块。

## Context

- **移植源（只读参考，不要改）**: ~/Project/hermes-task-runner/bin/htask.mjs
  - `transition` L343（状态迁移表 + 校验）
  - `readTask` L203 / `writeTask` L197 / `createTask` L313 / `newTaskId` L51（.htask/tasks/<id>.json + state.json 指针）
  - `parseApprovalYaml` L1695 / `loadApprovalPolicy` L1677 / `approvalDecision` L1726（分级审批）
  - `computeMetrics` L1555（TTV/等待/瓶颈，今天刚交付）
- **目标格式**: .htask/tasks/<id>.json（{id,title,status,plan,history[],implementDurationMs,...}）+ .htask/state.json（currentId 指针）+ .htask/approval.yaml——与 htask 完全同构
- **Cortex 风格参考**:
  - DomainManifest: src/core/registry.ts（id/name/description/detect/getTools/getHandlers）
  - 工具模式: src/domains/generic/tools/git-status.ts（ToolDefinition + execute 函数 + success/failure helper）
  - 状态存储参考: src/domains/laravel/workflows/run-state.ts（RunStateStore，.mcp/runs/ 模式）
  - 测试: src/__tests__/*.test.ts（node:test runner，tsx --test）
- 本任务只做基础层（纯模块），不做工具/manifest（任务 2）

## Current Behavior

- Cortex 无 orchestration domain，无任务状态机/存储/审批/metrics 模块
- 所有能力只在 htask.mjs（JS 单体）里，MCP agent 无法调用

## Expected Behavior

- src/domains/orchestration/state/state-machine.ts: 状态迁移表（CREATED→PLANNING→IMPLEMENTING→REVIEWING→VERIFYING→ACCEPTED→MERGED，FAILED/CANCELLED）+ transition(cwd, id, to, by) 校验非法迁移 + 写 history + 终态写 endedAt
- src/domains/orchestration/state/task-store.ts: createTask/readTask/writeTask/newTaskId + state.json 指针（幂等迁移旧结构）
- src/domains/orchestration/state/approval.ts: parseApprovalYaml（含行内注释支持——htask 刚修过这个 bug）/loadApprovalPolicy/approvalDecision
- src/domains/orchestration/metrics.ts: computeMetrics（TTV/wait_human/瓶颈排序/容错标注缺失）
- 全部纯 TS 模块，导出可单测函数

## Design

- 目录: src/domains/orchestration/{state/,metrics.ts}（本任务不建 tools/）
- 类型: 移植时定义 TS 接口（TaskRecord/HistoryEntry/Plan/ApprovalPolicy/MetricsReport），对齐 htask 的 JSON 字段名
- 存储: baseDir = projectPath/.htask/tasks/，指针 projectPath/.htask/state.json——与 htask 相同路径，实现互操作
- approval.yaml 解析: 复刻 htask 的零依赖 YAML 子集解析（含整行注释 + 行内注释 `值 # 注释` 剥离）
- metrics: 复刻 htask computeMetrics（缺 created/merged 的任务标注 missing，不计入汇总）
- 风格: 与现有 cortex 代码一致（TS strict、camelCase、错误处理用抛出 + 调用方捕获或返回对象）

## Files

- 新增: src/domains/orchestration/state/state-machine.ts
- 新增: src/domains/orchestration/state/task-store.ts
- 新增: src/domains/orchestration/state/approval.ts
- 新增: src/domains/orchestration/metrics.ts
- 新增: src/__tests__/orchestration-state.test.ts（状态机+存储）
- 新增: src/__tests__/orchestration-approval-metrics.test.ts（审批+metrics）
- 修改: 无（本任务不注册 manifest，任务 2 做）

## Constraints

- 不引新依赖（零依赖，Date/fs 纯 Node）
- 与 htask 的 .htask 数据格式字段名完全一致（互操作前提）
- 不修改 hermes-task-runner 的任何代码
- 不建 tools/ 和 manifest（任务 2 范围）
- TS strict 通过（npm run typecheck）

## Acceptance Criteria

- state-machine: 合法迁移通过 + 写 history；非法迁移拒绝；终态写 endedAt
- task-store: createTask 写文件 + 指针；readTask/writeTask 往返一致；旧 state.json 迁移幂等
- approval: 默认保守（全人工）；文件覆盖 low_risk:false；行内注释正确解析；坏文件 warn + 默认
- metrics: 缺数据任务标注 ⚠️ 不计入；汇总含 waitRatio/bottlenecks
- 新增单测 ≥ 15 个；全部测试通过（293 + 新增）

## Verification Commands

```bash
npm test
npm run typecheck
```

## Rollback Plan

- git revert <commit>（新增文件为主，删除即回滚）
