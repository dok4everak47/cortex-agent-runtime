import { runArtisan, getLogger } from "../mcp.js"

export function executeRunTest(args: Record<string, unknown>) {
  try {
    const filter = args.filter ? String(args.filter).trim() : ""
    const command = filter ? `test --filter ${filter}` : "test"
    const output = runArtisan(command)
    return { content: [{ type: "text" as const, text: output }] }
  } catch (err) {
    getLogger().error("runTest failed", { error: String(err) })
    return { content: [{ type: "text" as const, text: "Error: " + (err instanceof Error ? err.message : String(err)) }], isError: true as const }
  }
}
