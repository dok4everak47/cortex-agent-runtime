import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { getConfig } from "../mcp.js"

const SENSITIVE_PATTERNS = [
  "APP_KEY",
  "DB_PASSWORD",
  "_TOKEN",
  "_SECRET",
  "_KEY",
  "PASSWORD",
  "SECRET",
]

function isSensitiveLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) return false
  const key = trimmed.split("=", 1)[0].trim()
  return SENSITIVE_PATTERNS.some((pattern) => key.toUpperCase().includes(pattern))
}

export function executeEnvInfoSafe() {
  const { projectPath } = getConfig()
  const envPath = join(projectPath, ".env")

  if (!existsSync(envPath)) {
    return { content: [{ type: "text" as const, text: "Error: .env file not found at " + envPath }] }
  }

  const content = readFileSync(envPath, "utf-8")
  const lines = content.split("\n")
  const filtered = lines.filter((line) => !isSensitiveLine(line))

  return {
    content: [
      {
        type: "text" as const,
        text: filtered.join("\n"),
      },
    ],
  }
}
