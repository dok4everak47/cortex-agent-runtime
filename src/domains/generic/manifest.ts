import type { DomainManifest, ToolDefinition, ToolHandler } from "../../core/registry.js"
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
]

const toolHandlers: Record<string, ToolHandler> = {
  gitStatus: executeGitStatus,
  fileSearch: executeFileSearch,
  projectTree: executeProjectTree,
}

export const genericDomain: DomainManifest = {
  id: "generic",
  name: "Generic",
  description: "Project-type agnostic tools: git status, file search, project tree",
  detect: () => true,
  getTools: () => TOOL_DEFINITIONS,
  getHandlers: () => toolHandlers,
  getProjectPath: () => process.env.CORTEX_PROJECT_PATH,
}
