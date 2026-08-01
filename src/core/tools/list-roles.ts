import { success } from "../tool-helper.js"

export async function executeListRoles(_args: Record<string, unknown>) {
  const { registry } = await import("../registry.js")
  return success(JSON.stringify(registry.listRoles(), null, 2))
}
