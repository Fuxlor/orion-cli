# orion-cli

CLI d'initialisation pour le SDK **Orion** — se connecte à ton instance Orion, récupère ou crée un projet, et génère `orion.config.ts`.

## Usage

```bash
npx @orion-monitoring/cli
```

## Flow

```
1. Login avec ton compte     (email + mot de passe)
2. Sélectionner un projet    (ou en créer un nouveau)
3. Nom de la source          (ex: api-backend, worker-queue)
4. Description de la source  (ex: Gere l'api de l'app)
5. Environnement             (production / development / staging / test)
6. Génère orion.config.ts      (token dans .env ou directement)
```

## Fichier généré

```ts
// nom.config.ts
import { defineConfig } from 'orion-cli'

export default defineConfig({
  token: process.env.ORION_TOKEN!, // ou le token directement
  source: 'api-backend',
  environment: 'production',
  serverUrl: 'wss://api.monorion.com',
})
```