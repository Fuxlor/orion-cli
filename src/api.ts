import type {
  LoginResponse,
  Project,
  CreateProjectResponse,
  CreateTokenResponse,
  Source,
} from './types.js'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  baseUrl: string,
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...fetchOptions } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> ?? {}),
  }

  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${baseUrl}${path}`, {
    ...fetchOptions,
    headers,
    signal: AbortSignal.timeout(10_000),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const message = (data as { message?: string }).message ?? `HTTP ${res.status}`
    throw new ApiError(res.status, message)
  }

  return data as T
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function login(
  baseUrl: string,
  email: string,
  password: string,
): Promise<LoginResponse> {
  return request<LoginResponse>(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function listProjects(
  baseUrl: string,
  token: string,
): Promise<Project[]> {
  return request<Project[]>(baseUrl, '/api/projects', { token })
}

export async function createProject(
  baseUrl: string,
  token: string,
  name: string,
  label: string,
): Promise<CreateProjectResponse> {
  return request<CreateProjectResponse>(baseUrl, '/api/projects', {
    method: 'POST',
    token,
    body: JSON.stringify({ name, label }),
  })
}

export async function createSdkToken(
  baseUrl: string,
  token: string,
  projectName: string,
  sourceName: string,
): Promise<string> {
  const res = await request<{ token: string }>(
    baseUrl,
    `/api/projects/${encodeURIComponent(projectName)}/tokens`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({
        name: `${sourceName} SDK`,
        permissions: ['logs:write', 'heartbeat:write', 'performance:write', 'commands:write', 'commands:read'],
        source: sourceName,
      }),
    },
  )
  return res.token
}

export async function listSources(
  baseUrl: string,
  token: string,
  projectName: string,
): Promise<Source[]> {
  const res = await request<{ sources: Source[] }>(
    baseUrl,
    `/api/projects/${encodeURIComponent(projectName)}/sources`,
    { token },
  )
  return res.sources
}

export async function registerSource(
  baseUrl: string,
  token: string,
  projectName: string,
  name: string,
  description: string,
  env: string,
): Promise<{ name: string }> {
  return request<{ name: string }>(baseUrl, `/api/projects/${encodeURIComponent(projectName)}/sources`, {
    method: 'POST',
    token,
    body: JSON.stringify({ name, description, environment: env }),
  })
}