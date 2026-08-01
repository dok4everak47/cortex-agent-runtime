import type { StepOutput } from "../../run-plan.js"

export interface Diagnosis {
  pattern: string
  cause: string
  suggestion: string
}

export function diagnoseError(errorText: string): Diagnosis[] {
  const diagnoses: Diagnosis[] = []

  const db = /(SQLSTATE|PDOException)/i
  if (db.test(errorText)) {
    diagnoses.push({
      pattern: "SQLSTATE / PDOException",
      cause: "数据库连接失败或数据库迁移未执行",
      suggestion: "检查 .env 中的 DB_* 配置是否匹配你的数据库，然后运行 'php artisan migrate' 确保表结构已创建。若使用 sqlite 请确认 database/database.sqlite 存在。",
    })
  }

  const classMatch = errorText.match(/(?:Class\s+["']?([\w\\]+)["']?\s+not\s+found|Target\s+class\s+([\w\\]+)\s+does\s+not\s+exist)/i)
  if (classMatch) {
    const target = classMatch[1] || classMatch[2] || "..."
    diagnoses.push({
      pattern: "Class ... not found",
      cause: `未找到类 '${target}'：可能是缺少 use 导入、依赖注入类型错误，或类文件/命名空间不匹配`,
      suggestion: `确认该类已通过 use 导入，检查依赖注入的参数类型与实际绑定是否一致，并核对 app/ 下的类文件路径与命名空间。`,
    })
  }

  const method = /(Call\s+to\s+undefined\s+method|Method\s+[\w\\:]+::\w+\s+does\s+not\s+exist|BadMethodCallException)/i
  if (method.test(errorText)) {
    diagnoses.push({
      pattern: "Method ... not defined",
      cause: "调用了不存在的方法：可能是模型关系方法名拼写错误、缺少 trait，或方法未在类中定义",
      suggestion: "检查模型关系方法（hasMany/hasOne/belongsTo 等）的名称是否一致，确认相关 trait 已 use，或该方法确实定义在目标类上。",
    })
  }

  const csrf = /(419\s*[|]|CSRF\s+token\s+mismatch|Page\s+Expired)/i
  if (csrf.test(errorText)) {
    diagnoses.push({
      pattern: "419 / CSRF token mismatch",
      cause: "表单缺少 @csrf 字段，或 session 配置 / 令牌过期",
      suggestion: "在 Blade 表单中加入 @csrf；若为 API 请求请使用 Sanctum/Passport 的 token 认证并发送正确的 Authorization header。",
    })
  }

  const viewMatch = errorText.match(/View\s+\[?([\w./-]+)\]?\s+not\s+found/i)
  if (viewMatch) {
    diagnoses.push({
      pattern: "View ... not found",
      cause: `视图 '${viewMatch[1]}' 不存在`,
      suggestion: "在 resources/views 下创建对应的 Blade 文件（点号对应子目录），或检查 view() 中的视图名是否拼写正确。",
    })
  }

  if (diagnoses.length === 0) {
    diagnoses.push({
      pattern: "Unknown",
      cause: "未匹配到已知错误模式",
      suggestion: "请提供完整的 stack trace；可用 log 工具或查看 storage/logs/laravel.log 获取更多上下文。",
    })
  }

  return diagnoses
}

export async function execute(params: Record<string, unknown>, _projectPath: string): Promise<StepOutput> {
  const error = String(params.error ?? "")
  return { status: "done", diagnoses: diagnoseError(error) }
}
