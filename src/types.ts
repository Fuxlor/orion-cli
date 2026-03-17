export type Environment = 'production' | 'development' | 'staging' | 'test'

// ─── API responses ────────────────────────────────────────────────────────────

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

// ─── Generated config ─────────────────────────────────────────────────────────

export interface OrionConfig {
  token: string
}
