# TASK — Cortex orchestration domain 推进层（taskAccept/taskAdvance）

## Value Statement

- **谁受益**: 接 Cortex MCP 的 agent——第一次能**推进**任务（不只是看）；你从"替 agent 跑 accept/merge/push"中解放
- **解决什么**: 只读工具（任务2）能看状态但不能操作；推进能力只在 htask CLI 里
- **省多少时间**: agent 低风险任务全自动闭环（验证→merge→push），你只处理高风险人工闸门
- **改变什么行为**: 任务编排从"人操作 CLI"变为"agent 通过 MCP 直接推进，人只在闸门介入"

## Goal

把 htask 的 accept/advance/merge 核心逻辑移植为 Cortex 写工具，含 git 提交与审批闸门。
Before: agent 只能查任务状态。After: taskAccept/taskAdvance 可推进任务（含 git commit/push）。

## Context

- 基础层（任务1 fe8eca5）: src/domains/orchestration/state/{state-machine,task-store,approval}.ts + metrics.ts
- 工具层（任务2 a751ace）: manifest.ts + tools/{task-status,task-metrics,policy-get}.ts（detector 常驻注册）
- 移植源（只读参考）: ~/Project/hermes-task-runner/bin/htask.mjs
  - cmdAccept（VERIFYING+verify 全过 → ACCEPTED, by=human）
  - cmdAdvance（幂等 MERGED / VERIFYING 审批闸门 auto 过闸 / ACCEPTED → doMerge）
  - doMerge（git add -A → unstageExcluded → commit --no-verify → MERGED → push(失败仅 warn)；无改动归档不失败）
  - emitEvent（events.jsonl 追加，accept/advance 写事件）
- Cortex 工具风格: tools/task-status.ts（execute + success/failure + getConfig().projectPath）
- execSync 模式: src/core/tool-helper.ts 的 execSafe（注意: doMerge 需要 status 判断, 用 execSync try/catch 或 spawnSync）

## Current Behavior

- orchestration 只有只读工具；任务推进必须人工跑 htask CLI

## Expected Behavior

- `taskAccept`: 当前/指定任务 VERIFYING + verify 全过 → ACCEPTED（by=human）+ events.jsonl 事件；状态不对/验证未全过 → failure 明确报错
- `taskAdvance`: 完整推进链（对齐 htask cmdAdvance）:
  - MERGED → 幂等 no-op（提示已终态）
  - VERIFYING + verify 未全过 → failure（BLOCKED）
  - VERIFYING + 审批 human → 返回 WAITING_HUMAN 提示（不推进, 不报错）
  - VERIFYING + 审批 auto（或无 plan 旧任务）→ ACCEPTED → doMerge
  - ACCEPTED → doMerge（git commit + push）
- doMerge: git add -A → 排除 MERGE_EXCLUDE（REPORT.md/REVIEW.md/.htask）→ commit --no-verify -m <title> → transition MERGED → git push（失败仅 warn，任务仍完成）；"nothing to commit" 优雅归档
- 事件: accept/advance 各阶段写 .htask/events.jsonl（与 htask 同格式）

## Design

- 新增 src/domains/orchestration/tools/task-accept.ts: executeTaskAccept({taskId?})
- 新增 src/domains/orchestration/tools/task-advance.ts: executeTaskAdvance({taskId?, noPush?})
- 新增 src/domains/orchestration/state/task-merge.ts: doMerge（spawnSync git, MERGE_EXCLUDE, 无改动归档, push warn）
- 新增 src/domains/orchestration/state/events.ts: emitEvent（.htask/events.jsonl append，同 htask 格式）
- manifest.ts: getTools 加 2 个工具 + handlers 映射（工具名 taskAccept/taskAdvance，inputSchema: taskId string optional, noPush boolean optional）
- 复用基础层: transition/readTask/writeTask/loadApprovalPolicy/approvalDecision
- 无任务/任务不存在 → failure("taskAccept", ...) 友好错误
- noPush 默认 false（默认 push，对齐 htask advance；MCP 调用方可显式 noPush）

## Files

- 新增: src/domains/orchestration/tools/task-accept.ts
- 新增: src/domains/orchestration/tools/task-advance.ts
- 新增: src/domains/orchestration/state/task-merge.ts
- 新增: src/domains/orchestration/state/events.ts
- 修改: src/domains/orchestration/manifest.ts（+2 工具注册）
- 新增: src/__tests__/orchestration-advance.test.ts

## Constraints

- 不引新依赖（child_process 内置）
- git 操作用 spawnSync（需要 status），不用 execSafe（其吞退出码）
- MERGE_EXCLUDE 与 htask 一致: REPORT.md / REVIEW.md / .htask（含 .htask/**）
- 不修改 htask / 基础层 / 只读工具
- 工具默认 push（noPush 可选），push 失败不导致任务失败（与 htask 一致）
- events.jsonl 格式与 htask 完全一致（互操作）

## Acceptance Criteria

- taskAccept: VERIFYING+verify 全过 → ACCEPTED + 事件；verify 失败拒绝；非 VERIFYING 拒绝
- taskAdvance: MERGED 幂等；human 审批停 WAITING_HUMAN 不推进；auto 审批全链到 MERGED（git commit 存在）
- doMerge: commit message = 任务 title；REPORT.md/.htask 不进入 commit；无改动任务优雅归档不失败
- push: noPush 跳过；真实 push 失败仅 warn（用假 remote 或 --no-push 验证）
- 单测 ≥ 10 个（临时 git 仓库 fixture: git init + 基线 commit + 任务 JSON）
- 全部测试通过（342 + 新增）+ typecheck

## Verification Commands

```bash
npm test
npm run typecheck
# 冒烟（临时 git 仓库）: 构造 VERIFYING 任务 → taskAdvance(auto) → 验证 MERGED + commit
```

## Rollback Plan

- git revert <commit>（新增文件 + manifest 2 行）
