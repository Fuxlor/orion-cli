#!/usr/bin/env node

import {
  intro,
  outro,
  text,
  password,
  select,
  confirm,
  spinner,
  isCancel,
  cancel,
  note,
  log,
} from '@clack/prompts'
import pc from 'picocolors'
import { login, listProjects, createProject, createSdkToken, ApiError, registerSource } from './api.js'
import { writeConfig, configExists, normalizeName } from './writer.js'
import type { Environment } from './types.js'
import { loginWithBrowser } from './auth-browser.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bail(value: unknown): asserts value is NonNullable<typeof value> {
  if (isCancel(value)) {
    cancel('Setup cancelled.')
    process.exit(0)
  }
}

function orionBanner() {
  console.log()
  console.log(pc.cyan('  ╔═══════════════════════╗'))
  console.log(pc.cyan('  ║  ') + pc.bold(pc.white('O R I O N')) + pc.cyan('  ·  CLI    ║'))
  console.log(pc.cyan('  ╚═══════════════════════╝'))
  console.log()
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  orionBanner()
  intro(pc.bgCyan(pc.black(' orion-cli ')))

  // 0. Existing config?
  if (configExists()) {
    const overwrite = await confirm({
      message: pc.yellow('An orion.config.ts file already exists. Overwrite it?'),
      initialValue: false,
    })
    bail(overwrite)
    if (!overwrite) {
      cancel('Setup cancelled — existing configuration kept.')
      process.exit(0)
    }
  }

  const base = "http://localhost:3001";

  // 2. Connexion au compte Orion
  log.step('Sign in to your Orion account')

  // Offer two auth methods
  const authMethod = await select({
    message: 'How do you want to sign in?',
    options: [
      {
        value: 'browser',
        label: '🌐  Via browser',
        hint: 'Recommended',
      },
      {
        value: 'token',
        label: '🔑  Personal token',
        hint: 'Paste your token from the dashboard',
      },
    ],
  })
  bail(authMethod)

  let accessToken: string

  if (authMethod === 'browser') {
    try {
      accessToken = await loginWithBrowser(base)
    } catch (err) {
      cancel(`Authentication failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    }

  } else {
    // Fallback: manual token (useful in CI/CD or if the browser doesn't open)
    const manualToken = await password({
      message: 'Paste your personal token (from orion.dev/settings):',
      mask: '*',
    })
    bail(manualToken)
    accessToken = manualToken as string
  }

  // 3. Choose or create a project
  const projectsSpinner = spinner()
  projectsSpinner.start('Fetching projects...')

  let projects: { id: string; name: string; label: string }[] = []
  try {
    projects = await listProjects(base, accessToken)
    projectsSpinner.stop(pc.green(`✓ ${projects.length} project(s) found`))
  } catch {
    projectsSpinner.stop(pc.yellow('⚠ Could not load projects'))
  }

  const projectOptions = [
    ...projects.map((p) => ({
      value: p.name,
      label: p.label,
      hint: p.name,
    })),
    {
      value: '__new__',
      label: pc.cyan('+ Create a new project'),
      hint: '',
    },
  ]

  const selectedProject = await select({
    message: 'Which project do you want to use?',
    options: projectOptions,
  })
  bail(selectedProject)

  let projectName: string

  if (selectedProject === '__new__') {
    // Create a new project
    const rawLabel = await text({
      message: 'Project display name (label)?',
      placeholder: 'My Backend',
      validate: (v) => !v.trim() ? 'Label is required.' : undefined,
    })
    bail(rawLabel)

    const rawName = await text({
      message: 'Project identifier (slug)?',
      placeholder: normalizeName(rawLabel as string),
      initialValue: normalizeName(rawLabel as string),
      validate: (v) => {
        const n = normalizeName(v)
        if (!n) return 'Identifier is required.'
        if (!/^[a-z0-9][a-z0-9-]*$/.test(n)) return 'Lowercase letters, digits and hyphens only.'
        return undefined
      },
    })
    bail(rawName)

    const createSpinner = spinner()
    createSpinner.start('Creating project...')

    try {
      const created = await createProject(
        base,
        accessToken,
        normalizeName(rawName as string),
        (rawLabel as string).trim(),
      )
      projectName = created.name
      createSpinner.stop(pc.green(`✓ Project "${created.label}" created`))
    } catch (err) {
      createSpinner.stop(pc.red('✗ Creation failed'))
      cancel(`Erreur : ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    }
  } else {
    projectName = selectedProject as string
  }

  // 4. Nom de la source
  const source = await text({
    message: 'Source name (identifies the origin of logs)?',
    placeholder: 'api-backend',
    validate: (v) => {
      if (!v.trim()) return 'Required.'
      if (!/^[a-z0-9_-]+$/.test(v)) return 'Lowercase letters, digits and hyphens only.'
      return undefined
    },
  })
  bail(source)

  // 5. Description de la source
  const description = await text({
    message: 'Source description?',
    placeholder: 'User management',
  })
  bail(description)

  // 6. Environnement
  const environment = await select({
    message: 'Environment?',
    options: [
      { value: 'prod', label: 'Production', hint: 'prod' },
      { value: 'dev', label: 'Development', hint: 'dev' },
      { value: 'staging', label: 'Staging', hint: 'staging' },
      { value: 'test', label: 'Test', hint: 'test' },
    ],
  })
  bail(environment)

  // 7. Register source on server
  let result = await registerSource(base, accessToken, projectName as string, source as string, description as string, environment as string)

  // 8. Create source-bound SDK token
  const tokenSpinner = spinner()
  tokenSpinner.start('Creating SDK token...')

  let sdkToken: string
  try {
    sdkToken = await createSdkToken(base, accessToken, projectName as string, result.name)
    tokenSpinner.stop(pc.green('✓ SDK token created'))
  } catch (err) {
    tokenSpinner.stop(pc.red('✗ Could not create SDK token'))
    cancel(`Error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }

  // 9. Write config
  const writeSpinner = spinner()
  writeSpinner.start('Writing orion.config.ts...')

  const { configPath } = writeConfig(
    { token: sdkToken },
    process.cwd(),
  )

  writeSpinner.stop(pc.green('✓ Configuration written'))

  // 8. Summary
  note(
    [
      `Project    : ${pc.bold(projectName)}`,
      `Source     : ${pc.bold(result.name)}`,
      `Config     : ${pc.cyan(configPath)}`,
    ].join('\n'),
    'Summary',
  )

  // 9. Outro
  outro(
    pc.green('✓ Setup complete!\n\n') +
    '  Installez le SDK :\n' +
    pc.cyan('  npm install @orion-monitoring/sdk\n\n') +
    '  Puis dans votre code :\n' +
    pc.gray("  import { createLogger } from '@orion-monitoring/sdk'\n") +
    pc.gray('  const logger = await createLogger()\n') +
    pc.gray("  logger.info('Hello from Orion!')"),
  )
}

main().catch((err) => {
  console.error(pc.red('\nUnexpected error:'), err)
  process.exit(1)
})
