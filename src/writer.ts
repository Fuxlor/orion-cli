import fs from 'node:fs'
import path from 'node:path'
import type { OrionConfig } from './types.js'

export function writeConfig(
  config: OrionConfig,
  targetDir: string = process.cwd(),
): { configPath: string } {
  const orionDir = path.join(targetDir, '.orion')
  const configPath = path.join(orionDir, 'config.json')

  fs.mkdirSync(orionDir, { recursive: true })
  fs.writeFileSync(configPath, JSON.stringify({ token: config.token }, null, 2) + '\n', 'utf-8')

  return { configPath }
}

export function configExists(targetDir: string = process.cwd()): boolean {
  return fs.existsSync(path.join(targetDir, '.orion/config.json'))
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
