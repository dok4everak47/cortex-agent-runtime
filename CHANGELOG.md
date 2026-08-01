# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/) 规范，版本号遵循 [Semantic Versioning](https://semver.org/)。

## [1.0.0-beta.1] - 2026-08-01

### Added
- 泛化重构为 **cortex-agent-runtime**：MCP-native AI Agent Framework，项目类型无关
- core + domains 双层架构（`src/core/` 框架层 + `src/domains/` 项目域）
- 新域 `generic`：gitStatus / fileSearch / projectTree 三个语言无关工具
- `core/detector.ts` 项目类型检测（generic 永远加载；laravel 需 composer.json + artisan）
- `CORTEX_PROJECT_PATH` 环境变量（优先于 `LARAVEL_PROJECT_PATH`）

### Changed
- 目录改名 `laravel-ai-agent` → `cortex-agent-runtime`（npm/GitHub 同步）
- Laravel 域整体搬迁到 `src/domains/laravel/`，工具名与行为不变
- `tool-registry.ts` → `core/registry.ts`（ToolRegistry 域注册制）

## [0.9.0] - 2026-07-31 (demo)

### Added
- npm 发布 (beta tag)
- GitHub 安装支持
- workflowStatus 工具（list/get/resume/rollback）
- Golden Scenario 测试（5 个 E2E 场景）

## [0.8.0]

### Added
- createFeature workflow（含 Blade 视图）
- debugWorkflow（错误定位/诊断/建议）
- apiGenerator（REST API）
- workflows/index.ts 统一出口

## [0.7.0]

### Added
- security/ 模块（policy/validator/redactor）
- Context Resource（laravel://context）
- 危险命令黑名单（db:wipe/tinker 等）

## [0.6.0]

### Added
- Tool/Workflow 分离
- CRUD 拆分（planner/executor/steps）
- Context Manager（模块化缓存 + mtime 失效）

## [0.5.0]

### Added
- 8 个 Laravel 工具（artisan/schema/model/...）
- 安全白名单
- envInfoSafe 敏感过滤
- 日志系统
