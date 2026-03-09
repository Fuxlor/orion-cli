import fs from 'node:fs'
import path from 'node:path'
import type { OrionConfig } from './types.js'

export function writeConfig(
  config: OrionConfig,
  targetDir: string = process.cwd(),
): { configPath: string } {
  const configPath = path.join(targetDir, 'orion.config.ts')

  const content = [
    `import { defineConfig } from '@orion-monitoring/sdk'`,
    ``,
    `export default defineConfig({`,
    `  token: '${config.token}',`,
    `  projectName: '${config.projectName}',`,
    `  sourceName: '${config.sourceName}',`,
    `})`,
    ``,
  ].join('\n')

  fs.writeFileSync(configPath, content, 'utf-8')

  return { configPath }
}

export function configExists(targetDir: string = process.cwd()): boolean {
  return fs.existsSync(path.join(targetDir, 'orion.config.ts'))
}

// Normalise un nom de projet comme le fait ton backend
export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
