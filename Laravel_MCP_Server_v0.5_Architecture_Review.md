# Laravel MCP Server v0.5 架构问题与重构计划

## 当前状态

版本：

    v0.5.0
    feat: add crudGenerator workflow tool

项目已经从 MCP Tool 集合进入 Workflow 阶段。

主要能力：

-   Artisan 调用
-   Schema 分析
-   Migration 分析
-   Composer 分析
-   Route 分析
-   Frontend 扫描
-   CRUD Generator Workflow

------------------------------------------------------------------------

# 主要问题

## 1. Tool 与 Workflow 混合

当前：

    src/tools/

    artisan.ts
    schema.ts
    route-list.ts
    crud-generator.ts

问题：

Tool 是原子能力，Workflow 是多步骤流程。

建议：

    src/

    ├── tools/
    ├── workflows/
    │   └── crud/
    │       ├── planner.ts
    │       ├── executor.ts
    │       └── steps/
    └── context/

------------------------------------------------------------------------

## 2. crud-generator.ts 文件过大

当前约 468 行。

未来加入 Request、Policy、Resource、Factory、Seeder、Vue、Livewire
后会快速膨胀。

建议拆分：

    workflows/crud/

    planner.ts
    executor.ts

    steps/

    create-model.ts
    create-migration.ts
    create-controller.ts
    create-request.ts
    run-test.ts

------------------------------------------------------------------------

## 3. 缺少 Context Layer

新增：

    src/context/

    context-manager.ts
    builder.ts
    cache.ts

生成：

    .mcp/context.json

目标：

    Context
     ↓
    Workflow Planner
     ↓
    Executor

------------------------------------------------------------------------

## 4. Tool Namespace

建议：

    laravel.project.info
    laravel.database.schema
    laravel.artisan.makeModel
    laravel.workflow.crud

------------------------------------------------------------------------

# P1

## 5. Artisan 安全层

增加：

    security/

    policy.ts
    command-validator.ts

限制危险命令：

    db:wipe
    tinker
    危险 shell

------------------------------------------------------------------------

## 6. 敏感信息过滤

增加：

    security/redactor.ts

统一过滤：

-   APP_KEY
-   PASSWORD
-   TOKEN
-   SECRET

------------------------------------------------------------------------

## 7. Agent Bootstrap

目标：

AI 打开项目自动获得：

-   Laravel Version
-   PHP Version
-   Database
-   Models
-   Routes
-   Packages

增加：

    project.context

或者：

    laravel://context

------------------------------------------------------------------------

## 8. 测试升级

从：

    function test

升级：

    workflow scenario test

例如：

    create CRUD Post

    验证：

    Migration created
    Model created
    Controller created
    Test passed

------------------------------------------------------------------------

# 开发路线

## v0.6

-   Tool / Workflow 分离
-   CRUD Generator 拆分
-   Context Manager

## v0.7

-   Security Layer
-   Command Policy
-   Context Resource

## v0.8

-   createFeature
-   Debug Workflow
-   API Generator

------------------------------------------------------------------------

# 最终目标

从：

    Laravel MCP Server

升级为：

    Laravel AI Development Platform

架构：

    OpenCode

        |

    Laravel MCP Server

        |

    Context Engine
    Tool Layer
    Workflow Engine
    Security Layer

        |

    Laravel Project

------------------------------------------------------------------------

# 总结

当前阶段不要继续无止境增加 Tool。

核心路线：

    Tool 集合
    ↓
    Workflow Engine
    ↓
    Agent Context Platform

这是 v1.0 的关键路线。
