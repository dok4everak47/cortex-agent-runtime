import { existsSync, mkdirSync, readdirSync, writeFileSync } from "fs"
import { join } from "path"
import type { FieldDef } from "../../crud/planner.js"
import type { StepOutput } from "../../run-plan.js"

export function fieldLabel(name: string): string {
  return name
    .split("_")
    .map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ")
}

export function detectLayoutName(projectPath: string): string {
  const layoutsDir = join(projectPath, "resources", "views", "layouts")
  if (!existsSync(layoutsDir)) return "app"
  const files = readdirSync(layoutsDir).filter(f => f.endsWith(".blade.php")).sort()
  if (files.length === 0) return "app"
  return files[0].replace(/\.blade\.php$/, "")
}

function formField(field: FieldDef, entitySnake: string, mode: "create" | "edit"): string {
  const { name, type } = field
  const label = fieldLabel(name)
  const errorBlock = `                @error('${name}')
                    <span class="text-danger">{{ $message }}</span>
                @enderror`

  let control: string

  if (type === "text" || type === "json") {
    const val = mode === "edit"
      ? `{{ old('${name}', $${entitySnake}->${name}) }}`
      : `{{ old('${name}') }}`
    control = `                <textarea class="form-control" name="${name}" id="${name}" rows="5">${val}</textarea>`
  } else if (type === "boolean") {
    const checked = mode === "edit"
      ? `@if(old('${name}', $${entitySnake}->${name})) checked @endif`
      : `@if(old('${name}')) checked @endif`
    control = `                <input type="checkbox" name="${name}" id="${name}" value="1" ${checked}>`
  } else {
    const inputType = type === "integer" || type === "foreignId" ? "number"
      : type === "datetime" ? "datetime-local"
      : "text"
    const val = mode === "edit"
      ? `value="{{ old('${name}', $${entitySnake}->${name}) }}"`
      : `value="{{ old('${name}') }}"`
    control = `                <input type="${inputType}" class="form-control" name="${name}" id="${name}" ${val}>`
  }

  return `            <div class="form-group mb-3">
                <label for="${name}">${label}</label>
${control}
${errorBlock}
            </div>`
}

export function generateViews(
  entityPascal: string,
  entitySnake: string,
  entityPlural: string,
  fields: FieldDef[],
  layout: string,
): Record<string, string> {
  const routeBase = entityPlural.toLowerCase()
  const entityLabel = fieldLabel(entitySnake)
  const listLabel = fieldLabel(entityPlural)
  const singular = `$${entitySnake}`
  const collection = `$${entityPlural.toLowerCase()}`

  const headers = fields.map(f => `                    <th>${fieldLabel(f.name)}</th>`).join("\n")
  const cells = fields.map(f => `                        <td>{{ ${singular}->${f.name} }}</td>`).join("\n")
  const createFields = fields.map(f => formField(f, entitySnake, "create")).join("\n\n")
  const editFields = fields.map(f => formField(f, entitySnake, "edit")).join("\n\n")
  const showRows = fields
    .map(f => `            <dt>${fieldLabel(f.name)}</dt>\n            <dd>{{ ${singular}->${f.name} }}</dd>`)
    .join("\n")

  const index = `@extends('layouts.${layout}')

@section('title', '${listLabel}')

@section('content')
    <div class="container">
        <h1>${listLabel}</h1>
        <a href="{{ route('${routeBase}.create') }}" class="btn btn-primary mb-3">Create ${entityLabel}</a>

        <table class="table table-striped">
            <thead>
                <tr>
                    <th>ID</th>
${headers}
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                @foreach (${collection} as ${singular})
                    <tr>
                        <td>{{ ${singular}->id }}</td>
${cells}
                        <td>
                            <a href="{{ route('${routeBase}.show', ${singular}) }}">Show</a>
                            <a href="{{ route('${routeBase}.edit', ${singular}) }}">Edit</a>
                            <form action="{{ route('${routeBase}.destroy', ${singular}) }}" method="POST" style="display:inline">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="btn btn-sm btn-danger">Delete</button>
                            </form>
                        </td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    </div>
@endsection
`

  const create = `@extends('layouts.${layout}')

@section('title', 'Create ${entityLabel}')

@section('content')
    <div class="container">
        <h1>Create ${entityLabel}</h1>

        <form action="{{ route('${routeBase}.store') }}" method="POST" class="mt-3">
            @csrf
${createFields}
            <button type="submit" class="btn btn-primary">Save</button>
        </form>
    </div>
@endsection
`

  const edit = `@extends('layouts.${layout}')

@section('title', 'Edit ${entityLabel}')

@section('content')
    <div class="container">
        <h1>Edit ${entityLabel}</h1>

        <form action="{{ route('${routeBase}.update', ${singular}) }}" method="POST" class="mt-3">
            @csrf
            @method('PUT')
${editFields}
            <button type="submit" class="btn btn-primary">Update</button>
        </form>
    </div>
@endsection
`

  const show = `@extends('layouts.${layout}')

@section('title', '${entityLabel} Details')

@section('content')
    <div class="container">
        <h1>${entityLabel}</h1>

        <dl class="mt-3">
            <dt>ID</dt>
            <dd>{{ ${singular}->id }}</dd>
${showRows}
        </dl>

        <a href="{{ route('${routeBase}.edit', ${singular}) }}" class="btn btn-warning">Edit</a>
        <a href="{{ route('${routeBase}.index') }}" class="btn btn-secondary">Back</a>
    </div>
@endsection
`

  return { index, create, edit, show }
}

export async function execute(params: Record<string, unknown>, projectPath: string): Promise<StepOutput> {
  const entityPascal = params.entityPascal as string
  const entitySnake = params.entitySnake as string
  const entityPlural = params.entityPlural as string
  const fields = params.fields as FieldDef[]

  const layout = detectLayoutName(projectPath)
  const viewsDir = join(projectPath, "resources", "views", entityPlural.toLowerCase())
  mkdirSync(viewsDir, { recursive: true })

  const views = generateViews(entityPascal, entitySnake, entityPlural, fields, layout)
  const written: string[] = []

  for (const [name, content] of Object.entries(views)) {
    writeFileSync(join(viewsDir, `${name}.blade.php`), content)
    written.push(`resources/views/${entityPlural.toLowerCase()}/${name}.blade.php`)
  }

  return { status: "done", file: written.join(", ") }
}
