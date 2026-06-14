function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()

if (!apiBaseUrl) {
  throw new Error('Missing VITE_API_BASE_URL environment variable')
}

export const API_BASE_URL = trimTrailingSlash(apiBaseUrl)

export function toApiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}
