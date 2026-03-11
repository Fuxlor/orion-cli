# orion-cli

Initialization CLI for the **Orion** SDK — connects to your Orion instance, retrieves or creates a project, and generates `orion.config.ts`.

## Usage

```bash
npx @orion-monitoring/cli
```

## Flow

```
1. Log in with your account       (email + password)
2. Select a project               (or create a new one)
3. Source name                    (e.g. api-backend, worker-queue)
4. Source description             (e.g. Handles the app API)
5. Environment                    (production / development / staging / test)
6. Generate orion.config.ts       (token in .env or directly)
```

## Generated file

```ts
// orion.config.ts
import { defineConfig } from '@orion-monitoring/sdk'

export default defineConfig({
  token: process.env.ORION_TOKEN!, // or the token directly
  projectName: 'my-project' 
  sourceName: 'api-backend',
})
```
