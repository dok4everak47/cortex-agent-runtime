# TASK: v1.0 泛化 — Cortex Agent Runtime (MCP-native AI Agent Framework)

> 目标:把 laravel-ai-agent(现 v0.9.1,209 tests)从「Laravel 专用 MCP server」泛化为
> 「MCP-native AI Agent Runtime」—— 项目类型无关的 agent runtime,Laravel 变成其中一个 domain。
> 新 npm/GitHub/目录名:**cortex-agent-runtime**。

## 架构:core + domains 双层

```
src/
├── index.ts                 # 入口: detect → load domains → register → start MCP
├── core/                    # 框架层 — 与项目类型无关
│   ├── registry.ts          # ToolRegistry: domain 注册制(替代现在扁平的 tool-registry.ts)
│   ├── mcp.ts               # getConfig/getLogger(现有逻辑保留,路径解析抽到 domain)
│   ├── logger.ts            # 现有,不动
│   ├── detector.ts          # detectDomains(projectPath) → DomainId[]  ← 新增
│   └── context/             # 通用上下文接口(域模块由 domain 提供)
├── domains/
│   ├── laravel/             # 现有全部功能整体搬迁
│   │   ├── manifest.ts      # 导出 laravelDomain(见下)  ← 新增
│   │   ├── tools/           # 现有 src/tools/ 25 个工具原样搬
│   │   ├── workflows/       # 现有 src/workflows/ 4 个原样搬
│   │   ├── context/         # 现有 src/context/ 原样搬(模块化缓存)
│   │   ├── security/        # 现有 src/security/ 原样搬(policy/validator/redactor)
│   │   └── planner/         # 现有 src/planner/ 原样搬(intent/LLM/IntentGate)
│   └── generic/             # 新域 — 任何项目都加载  ← 新增
│       ├── manifest.ts      # 导出 genericDomain
│       └── tools/           # gitStatus / fileSearch / projectTree
└── __tests__/               # 现有测试全部保留,import 路径同步更新
```

## DomainManifest 接口(core/registry.ts 定义)

```typescript
export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface DomainManifest {
  id: string                                  // "laravel" | "generic"
  name: string
  description: string
  detect(projectPath: string): boolean        // 是否激活此域
  getTools(): ToolDefinition[]                // 注册进 tools/list
  getHandlers(): Record<string, ToolHandler>  // name → handler
  getProjectPath?(): string                   // 域特有路径解析(env 变量)
}
```

- `registry.ts` 暴露 `registerDomain(manifest)`,内部合并 tools + handlers;
  `listTools()` / `callTool(name, args)` 接口不变,index.ts 不用改行为。
- **现有测试全部保留**:只更新 import 相对路径(`../tools/artisan.js` → `../domains/laravel/tools/artisan.js` 等)。

## 项目类型检测(core/detector.ts)

```typescript
export function detectDomains(projectPath: string): DomainManifest[] {
  // generic 永远加载
  // laravel: 存在 composer.json && 存在 artisan 文件
}
```

- 路径解析:兼容 `LARAVEL_PROJECT_PATH`(向后兼容),新增通用 `CORTEX_PROJECT_PATH` 优先;
  都没有 → process.cwd()。
- 在非 Laravel 项目(如 Node 项目)运行 → 只有 generic 域 → 只有 3 个通用工具,不报错。

## 新域:generic(证明 runtime 泛化的最小用例)

3 个工具,都是语言无关的:

| 工具 | 描述 | 实现要点 |
|------|------|----------|
| `gitStatus` | git 状态摘要 | `git status --short --branch`,纯 execSync |
| `fileSearch` | 按 glob 搜文件名 | 复用 module-cache 里的最小 glob(不引新依赖),排除 .git/node_modules/vendor |
| `projectTree` | 目录树 2 层 | 复用 fileSearch 的 glob + 目录递归,排除同上 |

每个工具 1 个测试(和现有工具测试同风格,mock execSync / tmpdir)。

## 改名清单(同步执行)

1. **package.json**:`name` → `cortex-agent-runtime`,`description` → "MCP-native AI Agent Framework...",
   `repository.url` → `git+https://github.com/dok4everak47/cortex-agent-runtime.git`,
   keywords 加 `runtime`、`framework`、`agent`(保留 laravel/mcp 等已有)。
   version → `1.0.0-beta.1`(v0.9.1 → 1.0 是重大版本,先发 beta)。
2. **src/index.ts**:`new Server({ name: "cortex-agent-runtime", ... })`。
3. **README.md 重写**:
   - 标题:`# Cortex Agent Runtime — MCP-native AI Agent Framework`
   - hero 改用户价值表述:`Before: AI doesn't understand your project / After: AI can analyze, generate and debug applications`
   - 结构:Runtime 定位 → 已内置 domains(Laravel ✅ / Generic ✅)→ 快速开始(含 CORTEX_PROJECT_PATH)→ 现有工具表 → 架构(core/domains)→ 配置
   - **不堆砌数字**(用户偏好:18 tools / 209 tests 这种不写进 hero)
4. **docs/api.md**:更新名称引用;新工具(gitStatus/fileSearch/projectTree)加进文档。
5. **CONTRIBUTING.md / SECURITY.md**:更新 repo 链接到 cortex-agent-runtime。
6. **CHANGELOG.md**:加 v1.0.0-beta.1 条目(泛化重构 + generic domain + 改名)。
7. **消费端配置更新(重点坑,上次改名踩过)— ⚠️ 由外部执行,OpenCode 不要访问任何 ~/.config 或 ~/Project/opencode 路径**(run 模式无交互授权,会被 auto-reject):
   - `~/.config/opencode/opencode.jsonc`:mcp.laravel.workingDirectory
     → `/Users/dok4ever/Project/cortex-agent-runtime`;env 加 `CORTEX_PROJECT_PATH`
     (保留 LARAVEL_PROJECT_PATH 也行,二选一即可,建议都留);
     mcp 条目 key 改名 `laravel` → `cortex`(工具名不变,不影响现有会话)。
   - ⚠️ **不要 mv 目录**——你正在此目录里工作,改 cwd 会中断执行。
     目录改名 `mv ~/Project/laravel-ai-agent ~/Project/cortex-agent-runtime`
     由外部在代码验证通过后执行(见下)。

## GitHub + npm + 目录改名(发布,由外部执行,OpenCode 不做)

- GitHub:`dok4everak47/laravel-ai-agent` → `dok4everak47/cortex-agent-runtime`(API rename,301 自动跳转)。
- npm:`npm publish --tag beta` 发 `cortex-agent-runtime@1.0.0-beta.1`,
  然后 `npm deprecate laravel-ai-agent@0.9.1 "renamed to cortex-agent-runtime"`。
- 注意 WebAuthn EOTP 坑:发布遇 EOTP 让用户换新 token,别反复重试。

## 验证(全部必须过)

```bash
cd ~/Project/cortex-agent-runtime

# 1. 类型检查
npx tsc --noEmit

# 2. 全量测试(258 现有 + 新增 detector/registry/generic 测试,全部通过)
npm test

# 3. generic 域冒烟(在非 Laravel 目录跑,应只出 3 个通用工具)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | \
  CORTEX_PROJECT_PATH=/Users/dok4ever/.hermes/workspace npx tsx src/index.ts
# 期望: tools 含 gitStatus/fileSearch/projectTree,不含 artisan

# 4. laravel 域回归(在 blog 项目跑,工具数 = 25 laravel + 3 generic)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | \
  CORTEX_PROJECT_PATH=/Users/dok4ever/Project/blog npx tsx src/index.ts
# 期望: 28 个工具,含 artisan 等

# 5. OpenCode 集成(桌面端若缓存插件代码不生效,切 CLI 试)
opencode debug info   # 确认 mcp.cortex 注册成功
```

## 验收标准

- [ ] 258 现有测试 + 新增测试全绿
- [ ] 非 Laravel 项目只暴露 generic 工具,不崩
- [ ] Laravel 项目 28 工具,原 25 个行为不变(工具名不变)
- [ ] opencode.jsonc 指向新目录(外部步骤)
- [ ] GitHub repo 已改名,npm 新包已发布 + 旧包已 deprecate(外部步骤)

## 边界(不做)

- 不做多语言 domain(只有 laravel + generic)
- 不改任何工具的行为/签名/测试逻辑(纯搬迁 + 新通用工具)
- 不引入新 npm 依赖(glob 用现有实现)
