import { runArtisan } from "../mcp.js"

export function executeRunTest(args: Record<string, unknown>) {
  const filter = args.filter ? String(args.filter).trim() : ""
  const command = filter ? `test --filter ${filter}` : "test"
  const output = runArtisan(command)
  return { content: [{ type: "text" as const, text: output }] }
}
