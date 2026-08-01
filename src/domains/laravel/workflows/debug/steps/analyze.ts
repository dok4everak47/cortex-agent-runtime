import { existsSync, readFileSync } from "fs"
import { join } from "path"
import type { StepOutput } from "../../run-plan.js"

export function readSnippet(content: string, line: number, context = 8): string[] {
  const lines = content.split("\n")
  const idx = line - 1
  const start = Math.max(0, idx - context)
  const end = Math.min(lines.length, idx + context + 1)
  return lines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`)
}

export async function execute(params: Record<string, unknown>, projectPath: string): Promise<StepOutput> {
  const file = params.file as string | undefined
  const line = params.line as number | undefined

  if (!file) {
    return { status: "skipped", error: "No file to analyze" }
  }

  const fullPath = file.startsWith("/") ? file : join(projectPath, file)
  if (!existsSync(fullPath)) {
    return { status: "failed", error: `File not found: ${file}` }
  }

  const content = readFileSync(fullPath, "utf-8")
  const snippet = typeof line === "number" && line > 0 ? readSnippet(content, line) : null

  return { status: "done", file, content, snippet }
}
