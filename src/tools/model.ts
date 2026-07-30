import { runTinker } from "../mcp.js"

export function executeModel() {
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
  const output = runTinker(script)
  return { content: [{ type: "text" as const, text: output || "(no models found)" }] }
}
