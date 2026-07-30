import { runArtisan, runTinker } from "../mcp.js"

export function executeEnvInfo() {
  const lines: string[] = []

  const env = runArtisan("env")
  lines.push(`Environment: ${env || "failed to read"}`)

  const debug = runTinker(`echo config('app.debug') ? 'true' : 'false'`)
  lines.push(`Debug: ${debug || "failed to read"}`)

  const dbCheck = runTinker(`try { \\DB::connection()->getPdo(); echo 'OK'; } catch (\\Exception $e) { echo 'FAIL: ' . $e->getMessage(); }`)
  lines.push(`Database: ${dbCheck || "failed to check"}`)

  return { content: [{ type: "text" as const, text: lines.join("\n") }] }
}
