import { readdirSync, existsSync, readFileSync } from "fs"
import { join } from "path"
import { getConfig } from "../mcp.js"

interface Column {
  name: string
  type: string
  extras?: string
}

interface TableInfo {
  table: string
  columns: Column[]
  foreignKeys: { column: string; references: string }[]
  hasTimestamps: boolean
}

const COLUMN_PATTERN = /\$table->(\w+)\(['"]([\w_]+)['"]\)/
const FOREIGN_ID_PATTERN = /\$table->foreignId\(['"]([\w_]+)['"]\)->constrained\(\)/
const TIMESTAMPS_PATTERN = /\$table->timestamps\(\)/
const CREATE_TABLE_PATTERN = /Schema::create\(['"]([\w_]+)['"]/

const COLUMN_TYPES = [
  "string", "text", "integer", "bigIncrements",
  "boolean", "datetime", "timestamp", "float", "json",
  "bigInteger", "mediumInteger", "smallInteger", "tinyInteger",
  "unsignedBigInteger", "unsignedInteger",
  "decimal", "double", "char", "longText", "mediumText",
  "binary", "uuid", "guid", "ipAddress", "macAddress",
  "date", "dateTimeTz", "time", "timeTz", "timestampTz",
  "enum", "set", "jsonb", "nullableTimestamps",
  "rememberToken", "softDeletes", "softDeletesTz",
  "year", "morphs", "nullableMorphs", "uuidMorphs",
]

// Column-like methods that are handled separately (foreign keys, etc.)
const NON_COLUMN_TYPES = ["foreignId"]

export function parseColumn(line: string): Column | null {
  const match = line.match(COLUMN_PATTERN)
  if (!match) return null

  const type = match[1]
  const name = match[2]

  // Exclude non-column methods (handled by parseForeignId, etc.)
  if (NON_COLUMN_TYPES.includes(type)) return null

  // Only include known column types
  if (!COLUMN_TYPES.includes(type)) return null

  const extras: string[] = []
  if (line.includes("->nullable()")) extras.push("nullable")
  if (line.includes("->unique()")) extras.push("unique")
  if (line.includes("->default(")) {
    const dflt = line.match(/->default\(([^)]+)\)/)
    if (dflt) extras.push(`default: ${dflt[1]}`)
  }
  if (line.includes("->unsigned()")) extras.push("unsigned")

  if (extras.length > 0) {
    return { name, type, extras: extras.join(", ") }
  }
  return { name, type }
}

export function parseForeignId(line: string): { column: string; references: string } | null {
  const match = line.match(FOREIGN_ID_PATTERN)
  if (!match) return null
  return { column: match[1], references: `${match[1].replace(/_id$/, "")}.id` }
}

export function analyzeMigrations(migrationsDir: string): TableInfo[] {
  if (!existsSync(migrationsDir)) return []

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".php"))
    .sort()

  const tableMap = new Map<string, TableInfo>()

  for (const file of files) {
    const content = readFileSync(join(migrationsDir, file), "utf-8")

    // Find all create table blocks
    let match: RegExpExecArray | null
    const createRegex = new RegExp(CREATE_TABLE_PATTERN.source, "g")

    while ((match = createRegex.exec(content)) !== null) {
      const tableName = match[1]
      if (!tableMap.has(tableName)) {
        tableMap.set(tableName, {
          table: tableName,
          columns: [],
          foreignKeys: [],
          hasTimestamps: false,
        })
      }

      const info = tableMap.get(tableName)!

      // Find the closure body for this create table
      // Start from the opening `(` after Schema::create and match its `)`
      const openParenIdx = content.indexOf("(", match.index)
      let depth = 0
      let endIdx = openParenIdx
      for (let i = openParenIdx; i < content.length; i++) {
        if (content[i] === "(") depth++
        if (content[i] === ")") depth--
        if (depth === 0) {
          endIdx = i + 1
          break
        }
      }

      const block = content.substring(match.index, endIdx)
      const lines = block.split("\n")

      for (const line of lines) {
        const trimmed = line.trim()

        // Check timestamps
        if (TIMESTAMPS_PATTERN.test(trimmed)) {
          info.hasTimestamps = true
          continue
        }

        // Check foreignId constraints
        const fk = parseForeignId(trimmed)
        if (fk) {
          info.foreignKeys.push(fk)
          continue
        }

        // Check regular column
        const col = parseColumn(trimmed)
        if (col) {
          info.columns.push(col)
        }
      }
    }
  }

  return Array.from(tableMap.values())
}

function formatTables(tables: TableInfo[]): string {
  if (tables.length === 0) {
    return "No migration files found or no tables detected."
  }

  const parts: string[] = ["Tables inferred from migrations:"]

  for (const table of tables) {
    parts.push(`  ${table.table}:`)
    for (const col of table.columns) {
      const extra = col.extras ? ` (${col.extras})` : ""
      parts.push(`    ${col.name}: ${col.type}${extra}`)
    }
    for (const fk of table.foreignKeys) {
      parts.push(`    ${fk.column} → ${fk.references}`)
    }
    if (table.hasTimestamps) {
      parts.push("    timestamps")
    }
  }

  return parts.join("\n")
}

export function executeMigrationAnalyzer() {
  const { projectPath } = getConfig()
  const migrationsDir = join(projectPath, "database", "migrations")

  if (!existsSync(migrationsDir)) {
    return { content: [{ type: "text" as const, text: "Error: database/migrations directory not found." }] }
  }

  const tables = analyzeMigrations(migrationsDir)
  return { content: [{ type: "text" as const, text: formatTables(tables) }] }
}
