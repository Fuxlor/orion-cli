# orion-cli

CLI d'initialisation pour le SDK **Orion** — se connecte à ton instance Orion, récupère ou crée un projet, et génère `orion.config.ts`.

## Usage

```bash
npx orion-cli
# ou
npx create-orion
```

## Flow

```
2. Login avec ton compte     (email + mot de passe)
3. Sélectionner un projet    (ou en créer un nouveau)
4. Nom de la source          (ex: api-backend, worker-queue)
5. Environnement             (production / development / staging / test)
6. Génère nom.config.ts      (token dans .env ou directement)
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

## Variable d'environnement

| Variable         | Description                              |
|------------------|------------------------------------------|
| `ORION_API_URL`  | Pré-remplit l'URL du serveur au prompt   |
| `ORION_TOKEN`    | Token injecté si stocké dans `.env`      |

## Dev

```bash
npm install
npm run dev    # tsx watch
npm run build  # compile vers dist/
npm link       # teste `orion-cli` en global
```
