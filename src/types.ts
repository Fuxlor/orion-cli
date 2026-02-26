export type Environment = 'production' | 'development' | 'staging' | 'test'

// ─── Réponses API ─────────────────────────────────────────────────────────────

export interface LoginResponse {
  accessToken: string
  user: {
    id: number
    email: string
    pseudo: string
    first_name: string
    last_name: string
  }
}

export interface Project {
  id: string
  name: string
  label: string
}

export interface CreateProjectResponse {
  id: number
  name: string
  label: string
  token: string
}

export interface GetTokenResponse {
  token: string
}

// ─── Config générée ───────────────────────────────────────────────────────────

export interface OrionConfig {
  token: string
  projectName: string
  sourceName: string
}
