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
import { login, listProjects, createProject, getProjectToken, ApiError } from './api.js'
import { writeConfig, configExists, normalizeName } from './writer.js'
import type { Environment } from './types.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bail(value: unknown): asserts value is NonNullable<typeof value> {
  if (isCancel(value)) {
    cancel('Setup annulé.')
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

  // 0. Config existante ?
  if (configExists()) {
    const overwrite = await confirm({
      message: pc.yellow('Un fichier orion.config.ts existe déjà. L\'écraser ?'),
      initialValue: false,
    })
    bail(overwrite)
    if (!overwrite) {
      cancel('Setup annulé — configuration existante conservée.')
      process.exit(0)
    }
  }

  const base = "http://localhost:3001/";

  // 2. Connexion au compte Orion
  log.step('Connexion à votre compte Orion')
  // TODO: Login avec web (open auth flow in browser) or login from personnal user token or credentials, make it a prompt with options

  // 3. Choisir ou créer un projet
  const projectsSpinner = spinner()
  projectsSpinner.start('Récupération des projets...')

  let projects: { id: string; name: string; label: string }[] = []
  try {
    projects = await listProjects(base, accessToken)
    projectsSpinner.stop(pc.green(`✓ ${projects.length} projet(s) trouvé(s)`))
  } catch {
    projectsSpinner.stop(pc.yellow('⚠ Impossible de charger les projets'))
  }

  // Options : projets existants + créer nouveau
  type ProjectChoice = string // project name ou '__new__'

  const projectOptions = [
    ...projects.map((p) => ({
      value: p.name,
      label: p.label,
      hint: p.name,
    })),
    {
      value: '__new__',
      label: pc.cyan('+ Créer un nouveau projet'),
      hint: '',
    },
  ]

  const selectedProject = await select<ProjectChoice>({
    message: 'Quel projet utiliser ?',
    options: projectOptions,
  })
  bail(selectedProject)

  let projectToken: string
  let projectName: string

  if (selectedProject === '__new__') {
    // Créer un nouveau projet
    const rawLabel = await text({
      message: 'Nom affiché du projet (label) ?',
      placeholder: 'Mon Backend',
      validate: (v) => !v.trim() ? 'Le label est requis.' : undefined,
    })
    bail(rawLabel)

    const rawName = await text({
      message: 'Identifiant du projet (slug) ?',
      placeholder: normalizeName(rawLabel as string),
      initialValue: normalizeName(rawLabel as string),
      validate: (v) => {
        const n = normalizeName(v)
        if (!n) return 'Identifiant requis.'
        if (!/^[a-z0-9][a-z0-9-]*$/.test(n)) return 'Minuscules, chiffres et tirets uniquement.'
        return undefined
      },
    })
    bail(rawName)

    const createSpinner = spinner()
    createSpinner.start('Création du projet...')

    try {
      const created = await createProject(
        base,
        accessToken,
        normalizeName(rawName as string),
        (rawLabel as string).trim(),
      )
      projectToken = created.token
      projectName = created.name
      createSpinner.stop(pc.green(`✓ Projet "${created.label}" créé`))
    } catch (err) {
      createSpinner.stop(pc.red('✗ Échec de la création'))
      cancel(`Erreur : ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    }
  } else {
    // Projet existant → récupérer son token
    projectName = selectedProject as string

    const tokenSpinner = spinner()
    tokenSpinner.start('Récupération du token...')

    try {
      projectToken = await getProjectToken(base, accessToken, projectName)
      tokenSpinner.stop(pc.green('✓ Token récupéré'))
    } catch (err) {
      tokenSpinner.stop(pc.red('✗ Impossible de récupérer le token'))
      cancel(`Erreur : ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    }
  }

  // 4. Nom de la source
  const source = await text({
    message: 'Nom de la source (identifie l\'origine des logs) ?',
    placeholder: 'api-backend',
    validate: (v) => {
      if (!v.trim()) return 'Requis.'
      if (!/^[a-z0-9_-]+$/.test(v)) return 'Minuscules, chiffres, - et _ uniquement.'
      return undefined
    },
  })
  bail(source)

  // 5. Environnement
  const environment = await select<Environment>({
    message: 'Environnement ?',
    options: [
      { value: 'production',  label: 'Production',  hint: 'prod' },
      { value: 'development', label: 'Development', hint: 'dev' },
      { value: 'staging',     label: 'Staging',     hint: 'staging' },
      { value: 'test',        label: 'Test',        hint: 'test' },
    ],
  })
  bail(environment)

  // 6. Token dans .env ?
  const useEnv = await confirm({
    message: 'Stocker le token dans .env plutôt que dans orion.config.ts ?',
    initialValue: true,
  })
  bail(useEnv)

  // Remplacer wss:// ↔ http:// selon le protocole du serverUrl
  const wsUrl = base.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')

  // 7. Écriture
  const writeSpinner = spinner()
  writeSpinner.start('Écriture de orion.config.ts...')

  const { configPath, envPath } = writeConfig(
    {
      token: projectToken,
      source: source as string,
      environment: environment as Environment,
      serverUrl: wsUrl,
    },
    process.cwd(),
    useEnv as boolean,
  )

  writeSpinner.stop(pc.green('✓ Configuration écrite'))

  // 8. Résumé
  note(
    [
      `Projet     : ${pc.bold(projectName)}`,
      `Source     : ${pc.bold(source as string)}`,
      `Env        : ${pc.bold(environment as string)}`,
      `Serveur    : ${pc.cyan(wsUrl)}`,
      `Config     : ${pc.cyan(configPath)}`,
      envPath ? `Token dans : ${pc.cyan(envPath)}` : `Token dans : ${pc.cyan(configPath)}`,
    ].join('\n'),
    'Récapitulatif',
  )

  // 9. Outro
  outro(
    pc.green('✓ Setup terminé !\n\n') +
    '  Installez le SDK :\n' +
    pc.cyan('  npm install orion-cli\n\n') +
    '  Puis dans votre code :\n' +
    pc.gray("  import { createLogger } from 'orion-cli'\n") +
    pc.gray('  const logger = await createLogger()\n') +
    pc.gray("  logger.info('Hello from Orion!')"),
  )
}

main().catch((err) => {
  console.error(pc.red('\nErreur inattendue :'), err)
  process.exit(1)
})
