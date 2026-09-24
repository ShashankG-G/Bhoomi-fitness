// Central API client for the Bhoomi Fitness staff app.
//
// Base URL is configurable via VITE_API_URL (Vite env var), defaulting to
// http://localhost:8000 for local development against the backend.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const TOKEN_KEY = 'bhoomi_staff_token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  } catch {
    // localStorage unavailable (private browsing, etc.) - token just won't
    // persist across reloads on this device.
  }
}

// Registered by AuthContext so any 401 anywhere in the app clears the token
// and bounces back to the login screen, per spec.
let unauthorizedHandler = null
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn
}

// A typed error so callers can show a clean message instead of "Failed to fetch".
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

/**
 * Low-level fetch wrapper: attaches the bearer token, parses JSON, and
 * normalizes errors. `path` should start with a leading slash, e.g. "/api/staff/login".
 */
async function request(path, { method = 'GET', body, auth = true, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new ApiError(
      'Could not reach the server. Check your connection and the API address.',
      0,
      null
    )
  }

  let data = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (res.status === 401 && auth) {
    if (unauthorizedHandler) unauthorizedHandler()
    throw new ApiError(data?.detail || 'Session expired. Please log in again.', 401, data)
  }

  if (!res.ok) {
    const message =
      (typeof data?.detail === 'string' && data.detail) ||
      (Array.isArray(data?.detail) && data.detail[0]?.msg) ||
      data?.message ||
      `Request failed (${res.status})`
    throw new ApiError(message, res.status, data)
  }

  return data
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
}
