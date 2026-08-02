import type { DomainManifest, ToolDefinition, ToolHandler } from "../../core/registry.js"
import { executeTaskStatus } from "./tools/task-status.js"
import { executeTaskMetrics } from "./tools/task-metrics.js"
import { executePolicyGet } from "./tools/policy-get.js"

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
]

const toolHandlers: Record<string, ToolHandler> = {
  taskStatus: executeTaskStatus,
  taskMetrics: executeTaskMetrics,
  policyGet: executePolicyGet,
}

export const orchestrationDomain: DomainManifest = {
  id: "orchestration",
  name: "Orchestration",
  description: "任务编排只读工具: 任务状态、指标、审批策略",
  detect: () => true,
  getTools: () => TOOL_DEFINITIONS,
  getHandlers: () => toolHandlers,
  getProjectPath: () => process.env.CORTEX_PROJECT_PATH,
}
