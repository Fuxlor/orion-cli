import type { ApiVerifyResponse, NomConfig } from './types.js'

// URL de ton API — peut être surchargée via NOM_API_URL
const DEFAULT_API_URL = 'http://localhost:3001/api'

/**
 * Vérifie le token auprès de l'API et retourne les infos du projet.
 */
export async function verifyToken(
  token: string,
  apiUrl: string = DEFAULT_API_URL,
): Promise<ApiVerifyResponse> {
  try {
    const res = await fetch(`${apiUrl}/auth/me`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(8000), // timeout 8s
    })

    if (!res.ok) {
      if (res.status === 401) {
        return { valid: false, error: 'Token invalide ou expiré.' }
      }
      if (res.status === 404) {
        return { valid: false, error: 'Projet introuvable.' }
      }
      return { valid: false, error: `Erreur serveur (${res.status}).` }
    }

    const data = (await res.json()) as { projectName: string }
    return { valid: true, projectName: data.projectName }
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return { valid: false, error: 'Timeout — serveur injoignable.' }
    }
    return { valid: false, error: 'Impossible de contacter le serveur.' }
  }
}

/**
 * Construit les headers d'authentification pour les requêtes SDK.
 */
export function buildAuthHeaders(config: Pick<NomConfig, 'token'>): Record<string, string> {
  return {
    Authorization: `Bearer ${config.token}`,
    'X-Nom-Source': 'sdk',
  }
}
