import { runTinker } from "../mcp.js"
import { success, failure } from "../tool-helper.js"

const MODEL_SCAN_SCRIPT = `
  $dir = app_path('Models');
  if (!is_dir($dir)) {
    return;
  }
  $files = glob($dir . '/*.php');
  $models = [];
  foreach ($files as $file) {
    $class = 'App\\\\Models\\\\' . basename($file, '.php');
    if (class_exists($class) && is_subclass_of($class, \\Illuminate\\Database\\Eloquent\\Model::class)) {
      $models[] = $class;
    }
  }
  if (!empty($models)) {
    echo implode(PHP_EOL, $models);
  }
`.trim()

export function scanModels(): string[] {
  const output = runTinker(MODEL_SCAN_SCRIPT)
  return output
    .split("\n")
    .map((s) => s.trim())
    .filter((l) => l.length > 0 && !l.includes(" "))
}

export function executeModel() {
  try {
    const models = scanModels()
    if (models.length === 0) {
      return success("No Eloquent models found")
    }
    return success(models.join("\n"))
  } catch (err) {
    return failure("model", err)
  }
}
