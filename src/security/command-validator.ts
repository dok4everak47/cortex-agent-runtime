import type { CommandDecision } from "./policy.js"

const DANGEROUS_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /--force/, reason: "force flag" },
  { pattern: /rm\s+-rf/, reason: "recursive delete" },
  { pattern: />\s*\/dev\/null/, reason: "output discard" },
  { pattern: /&&\s*(rm|del|drop|truncate)/, reason: "chained destructive" },
  { pattern: /\|\s*(sh|bash|zsh)/, reason: "pipe to shell" },
]

export function validateArguments(command: string): CommandDecision {
  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return { allowed: false, reason, matchedRule: reason }
    }
  }
  return { allowed: true }
}
