# MCP LLM 语义层 — intentPlanner 升级

## 背景

规则版 intent-parser 处理模糊意图失败：
```
"增强博客的文章搜索功能" → 错误解析为 create_feature/Post（置信度 0.3）
```
需要接入 LLM 做语义理解。

## 架构

```
intentPlanner(request)
  ├── 规则版解析
  │     ├── 置信度 >= 0.8 → 直接用规则版结果
  │     └── 置信度 < 0.8 或未识别 → 走 LLM
  ├── LLM 语义解析（新）
  │     ├── LLM 可用 → 结构化 Intent
  │     └── LLM 不可用 → 回退规则版 + 提示"未启用 LLM 语义层"
  └── 输出统一 Intent
```

## 实现

### 新文件

```
src/planner/
├── intent-parser.ts   ← 现有，规则版
├── llm-analyzer.ts    ← 新增：LLM 语义分析
└── index.ts           ← 改造：两级路由（规则版 + LLM）
```

### llm-analyzer.ts

```typescript
export type LLMAnalyzerConfig = {
  apiKey: string
  baseUrl: string        // OpenAI 兼容接口
  model: string
  enabled: boolean
}

export function getLLMConfig(): LLMAnalyzerConfig {
  return {
    apiKey: process.env.LLM_API_KEY ?? "",
    baseUrl: process.env.LLM_BASE_URL ?? "https://api.deepseek.com/v1",
    model: process.env.LLM_MODEL ?? "deepseek-chat",
    enabled: !!process.env.LLM_API_KEY,
  }
}

export async function analyzeIntent(
  request: string,
  projectContext: unknown,   // 传入项目上下文帮助理解
): Promise<Intent | null> {
  // 1. 构建 prompt（system + user）
  // 2. 调 LLM，要求返回 JSON
  // 3. 解析 JSON → Intent
  // 4. 失败返回 null
}
```

### Prompt 设计

```
system: 你是 Laravel 项目的 AI 架构师。根据用户需求和项目上下文，
输出 JSON 格式的开发意图。只输出 JSON。

可用动作:
- create_feature: 创建完整功能（含视图）
- create_crud: 创建基础 CRUD
- create_api: 创建 REST API
- add_relation: 添加模型关系
- add_policy: 添加权限策略
- add_test: 添加测试
- enhance: 增强/优化现有功能  ← 新增
- fix_bug: 修复 bug          ← 新增
- debug: 调试

JSON 格式:
{
  "action": "enhance",
  "entity": "SearchController",
  "target": "search",           // 目标功能
  "fields": null,
  "options": {
    "views": false,
    "api": false,
    "auth": false
  },
  "summary": "用 PostgreSQL 全文搜索替代 LIKE，支持相关度排序"
}

user: 项目上下文: {models, routes, packages 摘要}
需求: {request}
```

### index.ts 两级路由

```typescript
export async function parseIntent(input: string, projectPath?: string): Promise<Intent> {
  const ruleBased = parseIntentRuleBased(input)   // 现有逻辑
  
  if (ruleBased.confidence >= 0.8) {
    return ruleBased
  }
  
  // 置信度低 → 尝试 LLM
  const llmConfig = getLLMConfig()
  if (llmConfig.enabled && projectPath) {
    const context = await getProjectContextSummary(projectPath)
    const llmResult = await analyzeIntent(input, context)
    if (llmResult) return llmResult
  }
  
  // LLM 不可用或失败 → 回退规则版
  return { ...ruleBased, summary: ruleBased.confidence < 0.8 ? "低置信度，建议启用 LLM_API_KEY" : ruleBased.summary }
}
```

### 新增 action 类型

plan-schema.ts 的 `PlannedAction` 增加：
- `enhance` — 增强/优化现有功能（调用 debugWorkflow 的 analyze 能力定位目标，输出修改建议）
- `fix_bug` — 修复 bug

feature-planner.ts 为 enhance 生成计划（不建新文件，输出修改点建议列表）。

### 环境变量

README 增加配置说明：

```
LLM_API_KEY=your-key          # 启用 LLM 语义层
LLM_BASE_URL=https://api.deepseek.com/v1   # 默认 DeepSeek
LLM_MODEL=deepseek-chat       # 默认模型
```

## 验证

```bash
# 规则版高置信度 → 不走 LLM
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"intentPlanner","arguments":{"request":"Create a Post CRUD","dryRun":true}}}' | LARAVEL_PROJECT_PATH=/path/to/blog npx tsx src/index.ts

# 模糊意图 → LLM 语义层（需设置 LLM_API_KEY）
LLM_API_KEY=xxx echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"intentPlanner","arguments":{"request":"增强博客的文章搜索功能，用全文搜索替代 LIKE","dryRun":true}}}' | LARAVEL_PROJECT_PATH=/path/to/blog npx tsx src/index.ts
# 期望: action=enhance, entity=SearchController, summary 描述改造方案

# 无 LLM key → 回退规则版
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"intentPlanner","arguments":{"request":"增强博客的文章搜索功能","dryRun":true}}}' | LARAVEL_PROJECT_PATH=/path/to/blog npx tsx src/index.ts

npx tsc --noEmit
npx tsx --test src/__tests__/*.test.ts
```

## 注意事项

- LLM 调用超时 15s，失败静默回退规则版
- 只对低置信度请求调 LLM（省成本）
- prompt 输出 JSON，解析失败回退
- 不引入新依赖（用 fetch 原生调用 OpenAI 兼容接口）
