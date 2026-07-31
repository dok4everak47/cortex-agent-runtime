# Security Policy

## 权限说明

Laravel MCP Server 在**当前用户权限**下运行，可以：
- 在配置的 Laravel 项目目录内执行 `php artisan` 命令
- 读取项目文件（composer.json、.env、迁移文件、日志等）
- 在项目目录内创建/修改文件（模型、控制器、迁移等生成物）

服务器**不会**：
- 请求管理员/root 权限
- 修改项目目录以外的文件
- 建立对外网络连接（见下文"数据是否离开本机"）

## 执行哪些命令

所有命令执行都经过安全层过滤：

### 白名单（可执行）

```
make:model / make:controller / make:migration / make:factory
make:seeder / make:request / make:policy
migrate / migrate:status / migrate:rollback
route:list / cache:clear / config:clear / config:get
view:clear / optimize:clear / test / env
```

### 黑名单（一律拒绝）

```
db:wipe        ← 清空数据库
migrate:fresh  ← 重置数据库
tinker         ← 交互式执行任意 PHP
shell          ← 执行任意 shell 命令
composer       ← 包管理操作
vendor:publish --force
```

### 危险参数检测

以下模式会被拦截：
- `--force` 强制覆盖
- `rm -rf` 递归删除
- `&& rm/del/drop/truncate` 链式破坏性命令
- `| sh/bash/zsh` 管道到 shell

## 数据是否离开本机

**否。完全本地运行。**

| 数据 | 处理方式 |
|------|---------|
| 项目代码 | 只在本机读取/写入 |
| .env 敏感字段 | 读取时即被 redactor 过滤，返回 `[REDACTED]` |
| 工具调用 | 全部通过本机 stdio 传输（MCP 协议） |
| 遥测 | 无（不发送任何使用数据） |
| 外部 API | 无（不调用任何网络服务） |

## 日志位置

- **MCP 服务器日志**: stderr（由 MCP 客户端收集），级别由 `LOG_LEVEL` 环境变量控制
- **工作流运行记录**: `<项目>/.mcp/runs/*.json`（执行历史，含步骤状态和产物文件）
- **上下文缓存**: `<项目>/.mcp/context/*.json`（项目结构缓存）

所有 `.mcp/` 数据都在项目目录内，不会上传。

## 如何报告漏洞

请通过 GitHub Security Advisory 报告：

https://github.com/dok4everak47/laravel-mcp-server/security/advisories/new

或直接发 Issue（保密问题请注明 "security"）：

https://github.com/dok4everak47/laravel-mcp-server/issues/new

报告请包含：
1. 漏洞类型（命令注入 / 路径遍历 / 信息泄露等）
2. 复现步骤
3. 受影响的版本
4. 修复建议（可选）

**请勿在公开 issue 中粘贴真实的 .env 内容或密钥。**
