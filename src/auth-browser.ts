/**
 * auth-browser.ts
 *
 * This module handles the CLI browser-based authentication flow.
 *
 * WHY a local HTTP server?
 * The browser cannot "write" to the terminal directly.
 * The only way for it to pass data to the CLI is to make an HTTP
 * request. So we open a mini server on localhost:7777 that listens
 * for up to 5 minutes.
 *
 * WHY the native `http` module?
 * To avoid adding a dependency (express, etc.) to a lightweight CLI.
 * The native module is sufficient for a single GET /callback route.
 *
 * REQUIRED DEPENDENCY: `open`
 * npm install open
 * (opens the default browser on macOS, Linux, Windows)
 */

import http from 'http'
import { URL } from 'url'
import { spinner, log } from '@clack/prompts'
import pc from 'picocolors'

// Fixed port on which the CLI listens for the callback
// This port must be whitelisted in the backend CORS if needed
const CALLBACK_PORT = 7777

// 5-minute maximum timeout for the user to log in via the browser
const AUTH_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Starts the browser-based auth flow.
 *
 * @param apiBase - Base URL of the API (e.g. "http://localhost:3001/")
 * @returns The JWT the CLI will use for API calls
 */
export async function loginWithBrowser(apiBase: string): Promise<string> {

    // ── STEP 1: Call /api/auth/cli/init ──────────────────────────────────────
    // We send our callback port to the backend.
    // The backend generates a state UUID and returns the login URL.

    const initRes = await fetch(`${apiBase}/api/auth/cli/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callbackPort: CALLBACK_PORT }),
    })

    if (!initRes.ok) {
        throw new Error(`Initialization error (${initRes.status})`)
    }

    const { loginUrl } = await initRes.json() as { state: string; loginUrl: string }

    // ── STEP 2: Open the browser ───────────────────────────────────────────────
    // `open` is a package that calls `xdg-open` (Linux), `open` (macOS),
    // or `start` (Windows) depending on the platform.

    log.info(pc.cyan(`Opening browser... if the browser does not open, copy this URL:\n  ${loginUrl}`))

    const { default: open } = await import('open')
    await open(loginUrl)

    // ── STEP 3: Start the local server and wait for the token ─────────────────
    // The website will redirect to http://localhost:7777/callback?token=xxx
    // Our server intercepts this, extracts the token, and shuts down.

    const spin = spinner()
    spin.start('Waiting for browser authentication...')

    const token = await waitForCallback()

    spin.stop(pc.green('✓ Authentication successful!'))

    return token
}


/**
 * Starts a local HTTP server on CALLBACK_PORT,
 * waits for a GET /callback?token=xxx,
 * returns the token and closes the server.
 *
 * Automatically times out after AUTH_TIMEOUT_MS.
 */
function waitForCallback(): Promise<string> {
    return new Promise((resolve, reject) => {

        const server = http.createServer((req, res) => {
            // On parse l'URL pour extraire le ?token= param
            const reqUrl = new URL(req.url ?? '/', `http://localhost:${CALLBACK_PORT}`)

            if (reqUrl.pathname !== '/callback') {
                // Unknown route → ignore
                res.writeHead(404)
                res.end()
                return
            }

            const token = reqUrl.searchParams.get('token')

            if (!token) {
                // No token in the URL → error
                res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
                res.end('<h2>Missing token. Please restart orion-cli.</h2>')
                server.close()
                reject(new Error('Missing token in callback'))
                return
            }

            // ✅ Token received! Respond to the browser with a nice page
            // and resolve the Promise.
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(`<!DOCTYPE html>
                <html lang="en">
                <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Orion CLI — Authenticated</title>
                <style>
                    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

                    body {
                    font-family: system-ui, -apple-system, sans-serif;
                    background: #0d0f16;
                    color: #e8eaef;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    }

                    .card {
                    width: 100%;
                    max-width: 24rem;
                    background: #13161f;
                    border: 1px solid #252b3b;
                    border-radius: 1rem;
                    padding: 2rem;
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
                    width: 3rem;
                    height: 3rem;
                    background: rgba(34, 197, 94, 0.1);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 1rem;
                    }

                    .icon-wrap svg {
                    color: #4ade80;
                    }

                    h2 {
                    font-size: 1rem;
                    font-weight: 600;
                    color: #ffffff;
                    margin-bottom: 0.25rem;
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
                    <p class="subtitle">CLI Authentication</p>

                    <div class="icon-wrap">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    </div>

                    <h2>Authentication successful!</h2>
                    <p>You can close this tab and return to your terminal.</p>

                    <div class="divider"></div>

                    <p class="hint">Le setup continue dans <code>orion-cli</code></p>
                </div>
                </body>
            </html>`)

            // Cleanly close the server after responding
            server.close()
            resolve(token)
        })

        // Safety timeout: if the user doesn't log in in time
        const timeout = setTimeout(() => {
            server.close()
            reject(new Error('Timeout: no authentication received within 5 minutes.'))
        }, AUTH_TIMEOUT_MS)

        // When the server closes, clear the timeout
        server.on('close', () => clearTimeout(timeout))

        // Start listening on the port
        server.listen(CALLBACK_PORT, '127.0.0.1', () => {
            // Server is ready, spinner can display its message
        })

        // Error handling if the port is already in use
        server.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
                reject(new Error(
                    `Port ${CALLBACK_PORT} is already in use.\n` +
                    `Close the process using it and restart orion-cli.`
                ))
            } else {
                reject(err)
            }
        })
    })
}