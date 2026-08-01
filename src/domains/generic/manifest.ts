import type { DomainManifest, ToolDefinition, ToolHandler } from "../../core/registry.js"
import { executeListRoles } from "../../core/tools/list-roles.js"
import { executeToolStats } from "../../core/tools/tool-stats.js"
import { executeGitStatus } from "./tools/git-status.js"
import { executeFileSearch } from "./tools/file-search.js"
import { executeProjectTree } from "./tools/project-tree.js"

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "gitStatus",
    description: "Show a git status summary (branch, staged and unstaged changes).",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "fileSearch",
    description: "Search for files by glob pattern, excluding .git, node_modules and vendor.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Glob pattern relative to the project root (e.g. 'src/**/*.ts')" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "projectTree",
    description: "Show a two-level directory tree of the project, excluding .git, node_modules and vendor.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "listRoles",
    description: "列出当前项目可用的角色及其绑定的工具（skill 绑定），一次调用即可了解可以以哪些身份工作、每个角色能用什么工具。",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "toolStats",
    description: "返回所有 MCP 工具的调用统计（调用次数 / 平均耗时 / 最近调用时间），传 { reset: true } 可先清零全部统计再返回。",
    inputSchema: {
      type: "object",
      properties: {
        reset: { type: "boolean", description: "若为 true，清零全部工具调用统计" },
      },
      required: [],
    },
  },
]

const toolHandlers: Record<string, ToolHandler> = {
  gitStatus: executeGitStatus,
  fileSearch: executeFileSearch,
  projectTree: executeProjectTree,
  listRoles: executeListRoles,
  toolStats: executeToolStats,
}

export const genericDomain: DomainManifest = {
  id: "generic",
  name: "Generic",
  description: "Project-type agnostic tools: git status, file search, project tree",
  detect: () => true,
  getTools: () => TOOL_DEFINITIONS,
  getHandlers: () => toolHandlers,
  getProjectPath: () => process.env.CORTEX_PROJECT_PATH,
  roles: [
    {
      id: "explorer",
      name: "探索者",
      description: "项目探索：查看 git 状态、搜索文件、浏览目录结构",
      tools: ["gitStatus", "fileSearch", "projectTree"],
    },
  ],
}
