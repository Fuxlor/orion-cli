/**
 * auth-browser.ts
 *
 * Ce module gère le flow d'authentification CLI via navigateur.
 *
 * POURQUOI un serveur HTTP local ?
 * Le navigateur ne peut pas "écrire" dans le terminal directement.
 * La seule façon pour lui de transmettre une donnée au CLI est
 * de faire une requête HTTP. On ouvre donc un mini serveur sur
 * localhost:7777 qui écoute pendant max 5 minutes.
 *
 * POURQUOI le module `http` natif ?
 * Pour ne pas ajouter de dépendance (express, etc.) à un CLI léger.
 * Le module natif suffit pour une seule route GET /callback.
 *
 * DÉPENDANCE NÉCESSAIRE : `open`
 * npm install open
 * (ouvre le navigateur par défaut sur macOS, Linux, Windows)
 */

import http from 'http'
import { URL } from 'url'
import { spinner, log } from '@clack/prompts'
import pc from 'picocolors'

// Port fixe sur lequel le CLI écoute le callback
// Ce port doit être whitelisté dans le CORS du backend si besoin
const CALLBACK_PORT = 7777

// Timeout de 5 minutes max pour que l'user se connecte dans le navigateur
const AUTH_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Lance le flow d'auth via navigateur.
 *
 * @param apiBase - URL de base de l'API (ex: "http://localhost:3001/")
 * @returns Le JWT que le CLI pourra utiliser pour les appels API
 */
export async function loginWithBrowser(apiBase: string): Promise<string> {

    // ── ÉTAPE 1 : Appelle /api/auth/cli/init ─────────────────────────────────
    // On envoie notre port de callback au backend.
    // Le backend génère un state UUID et nous retourne l'URL de login.

    const initRes = await fetch(`${apiBase}/api/auth/cli/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callbackPort: CALLBACK_PORT }),
    })

    if (!initRes.ok) {
        throw new Error(`Erreur lors de l'initialisation (${initRes.status})`)
    }

    const { loginUrl } = await initRes.json() as { state: string; loginUrl: string }

    // ── ÉTAPE 2 : Ouvre le navigateur ─────────────────────────────────────────
    // `open` est un package qui appelle `xdg-open` (Linux), `open` (macOS),
    // ou `start` (Windows) selon la plateforme.

    log.info(pc.cyan(`Ouverture du navigateur... si le navigateur ne s'ouvre pas, copiez cette URL :\n  ${loginUrl}`))

    const { default: open } = await import('open')
    await open(loginUrl)

    // ── ÉTAPE 3 : Démarre le serveur local et attend le token ─────────────────
    // Le website va rediriger vers http://localhost:7777/callback?token=xxx
    // Notre serveur intercepte ça, extrait le token, et se ferme.

    const spin = spinner()
    spin.start('En attente de l\'authentification dans le navigateur')

    const token = await waitForCallback()

    spin.stop(pc.green('✓ Authentification réussie !'))

    return token
}


/**
 * Démarre un serveur HTTP local sur CALLBACK_PORT,
 * attend un GET /callback?token=xxx,
 * retourne le token et ferme le serveur.
 *
 * Timeout automatique après AUTH_TIMEOUT_MS.
 */
function waitForCallback(): Promise<string> {
    return new Promise((resolve, reject) => {

        const server = http.createServer((req, res) => {
            // On parse l'URL pour extraire le ?token= param
            const reqUrl = new URL(req.url ?? '/', `http://localhost:${CALLBACK_PORT}`)

            if (reqUrl.pathname !== '/callback') {
                // Route inconnue → on ignore
                res.writeHead(404)
                res.end()
                return
            }

            const token = reqUrl.searchParams.get('token')

            if (!token) {
                // Pas de token dans l'URL → erreur
                res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
                res.end('<h2>Token manquant. Relancez orion-cli.</h2>')
                server.close()
                reject(new Error('Token manquant dans le callback'))
                return
            }

            // ✅ On a le token ! On répond au navigateur avec une belle page
            // et on résout la Promise.
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(`<!DOCTYPE html>
                <html lang="fr">
                <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Orion CLI — Authentifié</title>
                <style>
                    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

                    body {
                    font-family: system-ui, -apple-system, sans-serif;
                    background: #161a24;
                    color: #e8eaef;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    }

                    .card {
                    width: 100%;
                    max-width: 22rem;
                    background: #1c2130;
                    border: 1px solid #252b3b;
                    border-radius: 1rem;
                    padding: 2.5rem 2rem;
                    text-align: center;
                    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
                    }

                    .logo {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #ffffff;
                    letter-spacing: -0.02em;
                    margin-bottom: 0.25rem;
                    }

                    .subtitle {
                    font-size: 0.875rem;
                    color: #8b92a4;
                    margin-bottom: 2rem;
                    }

                    .icon-wrap {
                    width: 3.5rem;
                    height: 3.5rem;
                    background: rgba(2, 241, 148, 0.1);
                    border: 1px solid rgba(2, 241, 148, 0.25);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 1.25rem;
                    }

                    .icon-wrap svg {
                    color: #02f194;
                    }

                    h2 {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: #ffffff;
                    margin-bottom: 0.5rem;
                    }

                    p {
                    font-size: 0.875rem;
                    color: #8b92a4;
                    line-height: 1.5;
                    }

                    .divider {
                    height: 1px;
                    background: #252b3b;
                    margin: 1.5rem 0;
                    }

                    .hint {
                    font-size: 0.8125rem;
                    color: #8b92a4;
                    }

                    .hint code {
                    color: #02f194;
                    background: rgba(2, 241, 148, 0.08);
                    padding: 0.125rem 0.375rem;
                    border-radius: 0.25rem;
                    font-family: ui-monospace, monospace;
                    font-size: 0.8125rem;
                    }
                </style>
                </head>
                <body>
                <div class="card">
                    <p class="logo">Orion</p>
                    <p class="subtitle">Authentification CLI</p>

                    <div class="icon-wrap">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    </div>

                    <h2>Authentification réussie !</h2>
                    <p>Vous pouvez fermer cet onglet<br>et retourner dans le terminal.</p>

                    <div class="divider"></div>

                    <p class="hint">Le setup continue dans <code>orion-cli</code></p>
                </div>
                </body>
            </html>`)

            // Ferme le serveur proprement après avoir répondu
            server.close()
            resolve(token)
        })

        // Timeout de sécurité : si l'user ne se connecte pas dans les temps
        const timeout = setTimeout(() => {
            server.close()
            reject(new Error('Timeout : aucune authentification reçue en 5 minutes.'))
        }, AUTH_TIMEOUT_MS)

        // Quand le serveur se ferme, on clear le timeout
        server.on('close', () => clearTimeout(timeout))

        // Lance l'écoute sur le port
        server.listen(CALLBACK_PORT, '127.0.0.1', () => {
            // Le serveur est prêt, le spinner peut afficher son message
        })

        // Gestion d'erreur si le port est déjà occupé
        server.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
                reject(new Error(
                    `Le port ${CALLBACK_PORT} est déjà utilisé.\n` +
                    `Fermez le processus qui l'utilise et relancez orion-cli.`
                ))
            } else {
                reject(err)
            }
        })
    })
}