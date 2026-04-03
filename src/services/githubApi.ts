import type { AppSettings } from '../types/models'

const toBase64 = (value: string) => {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

const fromBase64 = (value: string) => {
  const binary = atob(value)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

const encodeRepositoryPath = (path: string) =>
  path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')

const buildContentsUrl = (settings: AppSettings, path: string) =>
  `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/contents/${encodeRepositoryPath(path)}?ref=${encodeURIComponent(settings.branch)}`

export const buildRawPublicUrl = (settings: AppSettings, repositoryPath: string) => {
  if (settings.preferLocalPublicFiles) {
    return `/${repositoryPath.replace(/^public\//, '')}`
  }
  return `https://raw.githubusercontent.com/${settings.repoOwner}/${settings.repoName}/${settings.branch}/${repositoryPath}`
}

export class GitHubApiError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = 'GitHubApiError'
    this.status = status
    this.code = code
  }
}

const parseGitHubError = async (response: Response) => {
  const remaining = response.headers.get('x-ratelimit-remaining')
  const resetAt = response.headers.get('x-ratelimit-reset')
  let message = 'GitHub API 요청에 실패했습니다.'
  let code = 'github_error'

  try {
    const payload = (await response.json()) as { message?: string }
    if (payload.message) {
      message = payload.message
    }
  } catch {
    const text = await response.text()
    if (text) {
      message = text
    }
  }

  if (response.status === 401) {
    code = 'auth_failed'
    message = 'GitHub token이 유효하지 않거나 권한이 부족합니다.'
  } else if (response.status === 403 && remaining === '0') {
    code = 'rate_limit'
    message = resetAt
      ? `GitHub API rate limit이 초과되었습니다. reset=${resetAt}`
      : 'GitHub API rate limit이 초과되었습니다.'
  } else if (response.status === 404) {
    code = 'not_found'
    message = '요청한 GitHub 파일을 찾지 못했습니다.'
  }

  return new GitHubApiError(message, response.status, code)
}

const apiRequest = async <T>(
  settings: AppSettings,
  path: string,
  init: RequestInit = {},
  token = settings.token,
) => {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/vnd.github+json')
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(buildContentsUrl(settings, path), {
    ...init,
    headers,
  })

  if (!response.ok) {
    throw await parseGitHubError(response)
  }

  return (await response.json()) as T
}

export interface RepositoryFilePayload {
  sha: string
  content: string
}

export const readPublicJson = async <T>(
  settings: AppSettings,
  repositoryPath: string,
): Promise<T> => {
  const response = await fetch(buildRawPublicUrl(settings, repositoryPath), {
    cache: 'no-store',
  })
  if (!response.ok) {
    throw await parseGitHubError(response)
  }
  return (await response.json()) as T
}

export const readRepositoryFile = async (
  settings: AppSettings,
  repositoryPath: string,
  token = settings.token,
): Promise<RepositoryFilePayload> => {
  const payload = await apiRequest<{
    sha: string
    content: string
  }>(settings, repositoryPath, {}, token)

  return {
    sha: payload.sha,
    content: fromBase64(payload.content.replace(/\n/g, '')),
  }
}

export const readRepositoryJson = async <T>(
  settings: AppSettings,
  repositoryPath: string,
  token = settings.token,
) => JSON.parse((await readRepositoryFile(settings, repositoryPath, token)).content) as T

export const writeRepositoryTextFile = async (
  settings: AppSettings,
  repositoryPath: string,
  content: string,
  message: string,
  token = settings.token,
) => {
  if (!token) {
    throw new GitHubApiError('GitHub token이 필요합니다.', 401, 'auth_failed')
  }

  let sha: string | undefined
  try {
    sha = (await readRepositoryFile(settings, repositoryPath, token)).sha
  } catch (error) {
    if (!(error instanceof GitHubApiError) || error.code !== 'not_found') {
      throw error
    }
  }

  return apiRequest(settings, repositoryPath, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: toBase64(content),
      branch: settings.branch,
      sha,
    }),
  })
}

export const deleteRepositoryFile = async (
  settings: AppSettings,
  repositoryPath: string,
  message: string,
  token = settings.token,
) => {
  if (!token) {
    throw new GitHubApiError('GitHub token이 필요합니다.', 401, 'auth_failed')
  }

  const existing = await readRepositoryFile(settings, repositoryPath, token)
  return apiRequest(settings, repositoryPath, {
    method: 'DELETE',
    body: JSON.stringify({
      message,
      sha: existing.sha,
      branch: settings.branch,
    }),
  })
}

export const writeRepositoryJson = async <T>(
  settings: AppSettings,
  repositoryPath: string,
  data: T,
  message: string,
  token = settings.token,
) =>
  writeRepositoryTextFile(
    settings,
    repositoryPath,
    `${JSON.stringify(data, null, 2)}\n`,
    message,
    token,
  )

export const uploadRepositoryBlob = async (
  settings: AppSettings,
  repositoryPath: string,
  base64Content: string,
  message: string,
  token = settings.token,
) => {
  if (!token) {
    throw new GitHubApiError('GitHub token이 필요합니다.', 401, 'auth_failed')
  }

  let sha: string | undefined
  try {
    sha = (await readRepositoryFile(settings, repositoryPath, token)).sha
  } catch (error) {
    if (!(error instanceof GitHubApiError) || error.code !== 'not_found') {
      throw error
    }
  }

  return apiRequest(settings, repositoryPath, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: base64Content,
      branch: settings.branch,
      sha,
    }),
  })
}

export const testRepositoryAccess = async (settings: AppSettings) =>
  readRepositoryFile(settings, settings.allowedUsersPath)
