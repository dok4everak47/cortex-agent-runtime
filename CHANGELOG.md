# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/) 规范，版本号遵循 [Semantic Versioning](https://semver.org/)。

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
