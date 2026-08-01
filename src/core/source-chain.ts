export type SourceStep<T> = {
  name: string
  priority: number
  resolve: () => T | null | Promise<T | null>
}

export type ChainResult<T> = {
  value: T
  source: string
  attempts: string[]
}

export class ChainError extends Error {
  readonly attempts: string[]

  constructor(attempts: string[]) {
    super(`Source chain exhausted after ${attempts.length} attempt(s): ${attempts.join(", ")}`)
    this.name = "ChainError"
    this.attempts = attempts
  }
}

/** 按 priority 降序尝试每一步；返回 null/undefined 视为本源失败并 fallback 到下一步。 */
export async function resolveChain<T>(steps: SourceStep<T>[]): Promise<ChainResult<T>> {
  const attempts: string[] = []
  const ordered = [...steps].sort((a, b) => b.priority - a.priority)

  for (const step of ordered) {
    attempts.push(step.name)
    const value = await step.resolve()
    if (value !== null && value !== undefined) {
      return { value, source: step.name, attempts }
    }
  }

  throw new ChainError(attempts)
}
