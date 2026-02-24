import fs from 'node:fs'
import path from 'node:path'
import type { OrionConfig } from './types.js'

export function writeConfig(
  config: OrionConfig,
  targetDir: string = process.cwd(),
  useEnvForToken = true,
): { configPath: string; envPath?: string } {
  const configPath = path.join(targetDir, 'orion.config.ts')

  const tokenLine = useEnvForToken
    ? `  token: process.env.ORION_TOKEN!,`
    : `  token: '${config.token}',`

  const content = [
    `import { defineConfig } from 'orion-cli'`,
    ``,
    `export default defineConfig({`,
    tokenLine,
    `  source: '${config.source}',`,
    `  environment: '${config.environment}',`,
    `  serverUrl: '${config.serverUrl}',`,
    `})`,
    ``,
  ].join('\n')

  fs.writeFileSync(configPath, content, 'utf-8')

  if (useEnvForToken) {
    const envPath = path.join(targetDir, '.env')
    const envEntry = `\n# Orion logging\nORION_TOKEN=${config.token}\n`
    fs.appendFileSync(envPath, envEntry, 'utf-8')
    return { configPath, envPath }
  }

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
