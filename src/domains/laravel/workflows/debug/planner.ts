import type { PlanItem } from "../run-plan.js"

export type DebugPlanItem = PlanItem & {
  type: "locate" | "analyze" | "diagnose" | "suggest"
}

export interface FileRef {
  file: string
  line?: number
}

export function extractFileFromError(error: string): FileRef | null {
  const abs = error.match(/(?<![\w/])(\/[^\s:"']+\.php):(\d+)/)
  if (abs) return { file: abs[1], line: parseInt(abs[2], 10) }

  const rel = error.match(/\b((?:app|routes|database|resources|config|tests)\/[\w./]+\.php):(\d+)/)
  if (rel) return { file: rel[1], line: parseInt(rel[2], 10) }

  const view = error.match(/View\s+\[?([\w./-]+)\]?\s+not\s+found/i)
  if (view) return { file: view[1] }

  return null
}

export function extractErrorMessage(error: string): string {
  const firstLine = error.split("\n").map(l => l.trim()).find(Boolean) ?? ""
  const m = firstLine.match(/^[\w\\]*(?:Exception|Error)[\w\\]*:\s*(.+)$/)
  return m ? m[1].trim() : firstLine
}

export function makeDebugPlan(error: string, file?: string): DebugPlanItem[] {
  const extracted = extractFileFromError(error)
  const targetFile = file?.trim() || extracted?.file
  const line = extracted?.line

  return [
    { step: 1, type: "locate", params: { hint: targetFile }, optional: true },
    { step: 2, type: "analyze", params: { file: targetFile, line }, optional: true },
    { step: 3, type: "diagnose", params: { error, message: extractErrorMessage(error) }, optional: false },
    { step: 4, type: "suggest", params: {}, optional: false },
  ]
}
