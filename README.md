# @orion-monitoring/cli

Interactive CLI to initialize the [Orion](https://orion.dev) SDK in your project. Authenticates with your Orion account, registers a source, and generates `orion.config.ts`.

## Usage

```bash
npx @orion-monitoring/cli
# or
npx create-orion
```

## What it does

```
1. Sign in to your Orion account     (browser or personal token)
2. Select or create a project
3. Select or create a source         (name, description, environment)
4. Generate SDK token                (scoped to your project + source)
5. Write orion.config.ts             (in the current directory)
```

## Interactive flow

### Authentication

Choose between two methods:

- **Browser (recommended)** — opens your default browser to complete login, then returns automatically to the terminal
- **Personal token** — paste an API token directly

### Project

Select an existing project from the list, or create a new one by providing a display name and a slug identifier.

### Source

A source represents one running instance of your application (e.g. `api-backend`, `worker-queue`). Select an existing source or create a new one:

- **Name** — lowercase, hyphens and digits only (e.g. `api-backend`)
- **Description** — free text (e.g. `Handles the main REST API`)
- **Environment** — `production`, `development`, `staging`, or `test`

### Result

```
Project    : my-project
Source     : api-backend
Config     : /your/project/orion.config.ts
```

## Generated file

```typescript
// orion.config.ts
import { defineConfig } from '@orion-monitoring/sdk'

export default defineConfig({
  token: 'your-sdk-token',
})
```

## Next steps

After running the CLI, install the SDK and start logging:

```bash
npm install @orion-monitoring/sdk
```

```typescript
import { createLogger } from '@orion-monitoring/sdk'

const logger = createLogger()
logger.info('App started')
```

## Requirements

- Node.js >= 18.0.0
- An Orion account and a running Orion API instance

## License

MIT
