import type { Diagnosis } from "./diagnose.js"
import type { StepOutput } from "../../run-plan.js"

export interface FileInfo {
  file?: string
  line?: number
  note?: string
  snippet?: string[]
}

export function buildSuggestions(fileInfo: FileInfo | undefined, diagnoses: Diagnosis[]): string[] {
  const suggestions: string[] = []

  if (fileInfo?.file) {
    suggestions.push(`已定位到疑似出错文件: ${fileInfo.file}${fileInfo.line ? ` (第 ${fileInfo.line} 行)` : ""}`)
    if (fileInfo.snippet && fileInfo.snippet.length > 0) {
      suggestions.push(`代码上下文:\n${fileInfo.snippet.join("\n")}`)
    }
  } else if (fileInfo?.note) {
    suggestions.push(fileInfo.note)
  } else {
    suggestions.push("未能在项目中定位到出错文件")
  }

  for (const d of diagnoses) {
    suggestions.push(`[${d.pattern}] ${d.cause}\n修复建议: ${d.suggestion}`)
  }

  return suggestions
}

export async function execute(params: Record<string, unknown>, _projectPath: string): Promise<StepOutput> {
  const locate = params.locate as { file?: string; line?: number; note?: string } | undefined
  const analyze = params.analyze as { file?: string; snippet?: string[] } | undefined
  const fileInfo: FileInfo = {
    file: locate?.file ?? analyze?.file,
    line: locate?.line,
    note: locate?.note,
    snippet: analyze?.snippet,
  }

  const diagnoses = ((params.diagnose as { diagnoses?: Diagnosis[] } | undefined)?.diagnoses) ?? []
  const suggestions = buildSuggestions(fileInfo, diagnoses)

  return { status: "done", suggestions }
}
