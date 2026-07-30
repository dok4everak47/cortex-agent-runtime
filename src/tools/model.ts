import { runTinker } from "../mcp.js"
import { success, failure } from "../tool-helper.js"

export function executeModel() {
  try {
    const script = `
      $dir = app_path('Models');
      if (!is_dir($dir)) {
        echo 'No Models directory found at app/Models';
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
      if (empty($models)) {
        echo 'No Eloquent models found';
      } else {
        echo implode(PHP_EOL, $models);
      }
    `.trim()
    return success(runTinker(script) || "(no models found)")
  } catch (err) {
    return failure("model", err)
  }
}
