import type { DomainManifest, ToolDefinition, ToolHandler } from "../../core/registry.js"
import { executeTaskStatus } from "./tools/task-status.js"
import { executeTaskMetrics } from "./tools/task-metrics.js"
import { executePolicyGet } from "./tools/policy-get.js"
import { executeTaskAccept } from "./tools/task-accept.js"
import { executeTaskAdvance } from "./tools/task-advance.js"

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "taskStatus",
    description: "列出项目所有编排任务 (id/标题/状态/state/下一步/停留时长/卡住), 文本表格对齐 htask list; 无 .htask 或无任务时返回提示。",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "taskMetrics",
    description: "输出编排任务 metrics 报告 (TTV 表 + 等待占比 + 瓶颈排序), 缺数据任务标 ⚠️; 无任务返回提示。",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "policyGet",
    description: "查看审批策略: 来源 (默认/file) + high/low 分级规则 + approval.yaml 路径。",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "taskAccept",
    description: "接受当前/指定任务: VERIFYING + verify 全过 → ACCEPTED (by=human); 状态不对或验证未全过 → 明确报错。",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "任务 ID, 缺省用当前任务" },
      },
      required: [],
    },
  },
  {
    name: "taskAdvance",
    description: "自动推进任务: MERGED 幂等 no-op; VERIFYING 验证未全过 → BLOCKED 报错; human 审批 → WAITING_HUMAN 不推进; auto/无 plan → ACCEPTED → doMerge (git commit + push, noPush 可选跳过)。",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "任务 ID, 缺省用当前任务" },
        noPush: { type: "boolean", description: "true 时跳过 git push (默认 false 即默认 push)" },
      },
      required: [],
    },
  },
]

const toolHandlers: Record<string, ToolHandler> = {
  taskStatus: executeTaskStatus,
  taskMetrics: executeTaskMetrics,
  policyGet: executePolicyGet,
  taskAccept: executeTaskAccept,
  taskAdvance: executeTaskAdvance,
}

export const orchestrationDomain: DomainManifest = {
  id: "orchestration",
  name: "Orchestration",
  description: "任务编排: 只读查询 (状态/指标/策略) + 推进 (accept/advance 含 git commit/push)",
  detect: () => true,
  getTools: () => TOOL_DEFINITIONS,
  getHandlers: () => toolHandlers,
  getProjectPath: () => process.env.CORTEX_PROJECT_PATH,
}
