import type { ModuleName } from "./module-cache.js"

export type ModuleSource = "cache" | "realtime" | "fallback"

export type ProjectContext = {
  laravel: {
    version: string
    phpVersion: string
    environment: string
    debug: boolean
    database: {
      driver: string
      name: string
    }
    framework: string
  }
  app: {
    name: string
    url: string
  }
  models: string[]
  tables: string[]
  routes: {
    count: number
    named: string[]
    groups: string[]
  }
  packages: {
    production: string[]
    dev: string[]
  }
  frontend: string[]
  structure: {
    controllers: number
    views: number
    migrations: number
    tests: number
  }
  builtAt: number
  source: string
  sourceByModule: Record<ModuleName, ModuleSource>
}
