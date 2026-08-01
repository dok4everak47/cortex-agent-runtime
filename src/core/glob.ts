import { existsSync, readdirSync, statSync, type Stats } from "fs"
import { join } from "path"

function hasGlobMeta(pattern: string): boolean {
  return pattern.includes("*")
}

function matchGlobSegment(name: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")
  return new RegExp(`^${escaped}$`).test(name)
}

function readdirSafe(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

function statSafe(path: string): Stats | null {
  try {
    return statSync(path)
  } catch {
    return null
  }
}

/** Resolve a relative glob pattern (supporting `*` and `**`) to absolute file paths. */
export function collectPattern(root: string, pattern: string): string[] {
  if (!hasGlobMeta(pattern)) {
    const full = join(root, pattern)
    return existsSync(full) ? [full] : []
  }

  const segments = pattern.split("/")
  const results: string[] = []

  const walk = (remaining: string[], current: string): void => {
    if (remaining.length === 0) return
    const [seg, ...rest] = remaining

    if (seg === "**") {
      walk(rest, current)
      for (const entry of readdirSafe(current)) {
        const full = join(current, entry)
        if (statSafe(full)?.isDirectory()) {
          walk(remaining, full)
        }
      }
      return
    }

    if (seg.includes("*")) {
      for (const entry of readdirSafe(current)) {
        if (!matchGlobSegment(entry, seg)) continue
        const full = join(current, entry)
        const stat = statSafe(full)
        if (rest.length === 0) {
          if (stat?.isFile()) results.push(full)
        } else if (stat?.isDirectory()) {
          walk(rest, full)
        }
      }
      return
    }

    const full = join(current, seg)
    const stat = statSafe(full)
    if (rest.length === 0) {
      if (stat?.isFile()) results.push(full)
    } else if (stat?.isDirectory()) {
      walk(rest, full)
    }
  }

  walk(segments, root)
  return results
}
