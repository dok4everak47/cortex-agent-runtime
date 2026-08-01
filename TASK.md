# TASK.md — Cortex Agent Runtime: 数据源优先级链 + 角色元数据

> 灵感来源: OpenClaw SystemPrompt 4 文件分层架构（AGENTS.md / SOUL.md / IDENTITY.md / USER.md）
> 两个设计借鉴点:
> 1. **数据源优先级链** — 多信息源按信任/新鲜度排序 fallback，最后兜底，不让"AI 自己看着办"
> 2. **三重角色 + skill 绑定** — 角色定义明确，每个角色绑定自己的工具集（skill），职责不重叠
>
> 目标: 把这两个设计落到 Cortex Agent Runtime，保持向后兼容（现有 273 个测试全绿）。

---

## Milestone 1 — 数据源优先级链 (SourceChain)

**背景**: OpenClaw 的 USER.md 定义了数据源优先级链 `memory_search → feishu-comm → 当日 memory → cron → ... → USER.md（最后兜底）`。每个请求按链取数，高优先级源失败自动 fallback 到低优先级源，最后有确定性兜底，**没有"AI 自己看着办"的模糊地带**。

**Cortex 现状**: `src/domains/laravel/context/builder.ts` 已有雏形——`safe()` 兜底 + `ModuleCache` 按 mtime 新鲜度判断 + `source: "cache" | "realtime"` 字段。但缺少:
- 显式的**链式 fallback 语义**（目前是 cache 新鲜就用 cache，否则 realtime，无中间层）
- 每模块的**来源可观测性**（source 只有整体一个字段，不知道每个模块来自哪）
- 可复用的**链式解析工具**（只有 Laravel domain 有，generic domain 无法用）

### 设计

**新增 `src/core/source-chain.ts`** — 通用的链式解析工具:

```ts
export type SourceStep<T> = {
  name: string                    // 源名，如 "cache" / "realtime" / "fallback"
  priority: number                // 越大越优先，先试
  resolve: () => T | null | Promise<T | null>   // 返回 null = 本源失败，fallback 到下一个
}

export type ChainResult<T> = {
  value: T
  source: string                  // 实际命中的源名
  attempts: string[]              // 尝试过的源名（顺序），便于可观测
}

export async function resolveChain<T>(steps: SourceStep<T>[]): Promise<ChainResult<T>>
```

语义:
- 按 `priority` 降序尝试每一步
- `resolve()` 返回 `null` → 记录到 `attempts`，尝试下一步
- 全部失败 → **throw 明确的 ChainError**（调用方决定兜底，不吞错）
- `attempts` 记录每个尝试过的源，用于日志/审计

**重构 `src/domains/laravel/context/builder.ts`**:

1. 引入 `ModuleSource = "cache" | "realtime" | "fallback"` 类型
2. `LoadedModule` 增加 `source: ModuleSource` 字段
3. `loadModule()` 改为用 `resolveChain`:
   - 步骤 1 `cache`: 有缓存且 `isFresh` → 返回缓存数据；否则 `null`
   - 步骤 2 `realtime`: 实际构建（`buildModule`）
   - （realtime 失败已有 `safe()` 兜底返回 fallback 值，此层保持）
4. `getContext()` 的 `ProjectContext.source` 改为**每模块来源映射**，同时保留整体字段兼容:

```ts
// types.ts 增加:
sourceByModule: Record<ModuleName, ModuleSource>
// 保留现有 source: "cache" | "realtime"（全部命中 cache 才为 "cache"，否则 "realtime"）
```

**新增 MCP 工具 `contextSource`**（Laravel domain）:
- 作用: 查看每个 context 模块的缓存命中情况与来源
- 输入: `{}`（或可选 `force` 先重建再报告）
- 输出: JSON `{ modules: { project: "cache", models: "realtime", ... }, builtAt, overall }`
- 价值: 让外部 agent 能审计"项目上下文来自缓存还是实时"，对应 OpenClaw 的"数据源信任层级"理念

### 测试 (`src/__tests__/source-chain.test.ts` + 更新 context-builder 测试)

- `resolveChain` 按优先级尝试、null 时 fallback、全失败 throw
- `resolveChain` 记录 attempts 顺序
- `contextSource` 工具注册 + 返回正确的每模块来源
- 现有 context-builder / context-cache 测试保持全绿（向后兼容断言: `source` 字段仍存在）

---

## Milestone 2 — 角色元数据 (RoleManifest)

**背景**: OpenClaw 的 IDENTITY.md 定义三重角色（技术合伙人 / 私人助理 / 家庭管家），每个角色有明确职责 + 绑定自己的 skill（工具调用 / cron+HEARTBEAT / memory/health/）。角色是"确定的不重叠的"，AI 根据场景切换但角色定义清晰。

**Cortex 现状**: `DomainManifest` 只有工具集合（`getTools()` / `getHandlers()`），没有"角色"概念。所有工具平铺，外部 agent 看到 26 个工具不知道哪个对应什么职责。

### 设计

**`src/core/registry.ts` 增加角色支持**:

```ts
export type RoleManifest = {
  id: string                        // 如 "engineer" / "maintainer"
  name: string                      // 如 "工程师" / "维护者"
  description: string               // 角色职责
  tools: string[]                   // 绑定到该角色的工具名（skill 绑定）
}

// DomainManifest 增加（可选，向后兼容）:
roles?: RoleManifest[]
```

**`ToolRegistry` 增加**:

```ts
listRoles(): RoleManifest[]   // 聚合所有 domain 声明的角色
getRoleTools(roleId: string): string[]  // 某角色的工具列表
```

**各 domain 声明角色**:

- `generic` domain: 角色 `explorer`（探索者）→ `gitStatus, fileSearch, projectTree`
- `laravel` domain: 角色 `engineer`（工程师）→ 核心编码工具（artisan, schema, model, routeList, runTest, makeModel, makeController, makeMigration, migrationAnalyzer, composerAnalyzer, crudGenerator, createFeature, apiGenerator, debugWorkflow, projectContext, intentPlanner, workflowStatus, envInfoSafe, configGet, log, frontendScanner, cache, migrateStatus, envInfo）
- 可加第三个角色 `maintainer`（维护者）→ 运维类工具（artisan, migrateStatus, cache, log, envInfo, envInfoSafe, configGet, runTest, workflowStatus, composerAnalyzer）

**新增 MCP 工具 `listRoles`**（两个 domain 都注册，registry 合并去重）:
- 输入: `{}`
- 输出: JSON 角色列表，每角色含 `id, name, description, tools[]`
- 价值: 外部 agent 调用一次就知道"这个项目我能以哪些角色工作，每个角色能用什么工具"——对应 IDENTITY.md 的"身份是确定的"

### 测试 (`src/__tests__/role-manifest.test.ts`)

- generic 声明 `explorer` 角色，tools 绑定正确
- laravel 声明 `engineer` + `maintainer`，工具名都是已注册工具（无悬空引用）
- `listRoles()` 聚合去重（同 id 角色合并 tools）
- `getRoleTools()` 返回正确工具列表
- `listRoles` MCP 工具返回合法 JSON
- 现有 registry.test.ts 保持全绿（roles 字段可选，不破坏现有断言）

---

## 验收标准

1. `npm run typecheck` 通过
2. `npm test` 全绿（现有测试 + 新增 source-chain / role-manifest / contextSource 测试）
3. `npm run build` 通过
4. 手工验证:
   - `echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | CORTEX_PROJECT_PATH=<临时laravel项目> npx tsx src/index.ts` 能看到新增的 `listRoles` 和 `contextSource` 工具
   - `listRoles` 返回 engineer/explorer/maintainer 角色及绑定工具
   - `contextSource` 返回每模块来源

## 约束

- **向后兼容**: 不改变现有工具名、参数、DomainManifest 必填字段（roles 可选）、ProjectContext 已有字段
- 不引入新依赖（标准库 + 现有 devDeps 足够）
- 遵循现有代码风格: 工具函数导出 `execute*` / `handle*`，工具定义在 manifest 的 `TOOL_DEFINITIONS`，用 `success`/`failure` helper 返回
- 中文注释/错误消息与现有代码一致（现有 planner/llm-analyzer 用中文 prompt）
- 不修改 dist/（构建产物），只改 src/ + 测试
