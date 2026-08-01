import { existsSync } from "fs"
import { join } from "path"
import { genericDomain } from "../domains/generic/manifest.js"
import { laravelDomain } from "../domains/laravel/manifest.js"
import type { DomainManifest } from "./registry.js"

export function detectDomains(projectPath: string): DomainManifest[] {
  const domains: DomainManifest[] = [genericDomain]
  if (laravelDomain.detect(projectPath)) {
    domains.push(laravelDomain)
  }
  return domains
}

export function isLaravelProject(projectPath: string): boolean {
  return existsSync(join(projectPath, "composer.json")) && existsSync(join(projectPath, "artisan"))
}
