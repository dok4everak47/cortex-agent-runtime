import { runTinker } from "../mcp.js"
import { success, failure } from "../tool-helper.js"

export function executeSchema(args: Record<string, unknown>) {
  try {
    const action = String(args.action ?? "")

    if (action === "tables") {
      const script = `
        $tables = \\Schema::getTables();
        foreach ($tables as $t) {
          echo (is_array($t) ? ($t['name'] ?? $t['schema'] . '.' . $t['name']) : $t) . PHP_EOL;
        }
      `.trim()
      return success(runTinker(script) || "(no tables)")
    }

    if (action === "columns") {
      const table = String(args.table ?? "")
      if (!table) {
        return failure("schema", new Error("'table' argument is required when action is 'columns'"))
      }
      const escaped = table.replace(/'/g, "\\'")
      const script = `
        $columns = \\Schema::getColumns('${escaped}');
        if (empty($columns)) {
          echo "Table '${escaped}' not found or has no columns.";
        } else {
          foreach ($columns as $col) {
            $type = $col['type_name'] ?? $col['type'] ?? 'unknown';
            $nullable = ($col['nullable'] ?? false) ? 'NULL' : 'NOT NULL';
            $default = isset($col['default']) ? 'DEFAULT ' . $col['default'] : '';
            echo $col['name'] . ' | ' . $type . ' | ' . $nullable . ($default ? ' | ' . $default : '') . PHP_EOL;
          }
        }
      `.trim()
      return success(runTinker(script))
    }

    return failure("schema", new Error(`unknown action '${action}'. Valid actions: tables, columns`))
  } catch (err) {
    return failure("schema", err)
  }
}
