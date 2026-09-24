// Thin fetch wrapper around the Bhoomi Fitness backend API.
//
// Base URL is configurable via VITE_API_URL (Vite env var), defaulting to
// http://localhost:8000 for local dev — never hardcode a production URL.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const TOKEN_KEY = 'bhoomi_access_token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // localStorage unavailable (e.g. private mode) — token just won't persist.
  }
}

export function clearToken() {
  setToken(null)
}

// Fired whenever a call gets a 401 so the app can redirect to login and
// clear stale state, no matter which screen triggered it.
const unauthorizedListeners = new Set()
export function onUnauthorized(fn) {
  unauthorizedListeners.add(fn)
  return () => unauthorizedListeners.delete(fn)
}

class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

async function request(path, { method = 'GET', body, auth = false, signal } = {}) {
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
    if (err.name === 'AbortError') throw err
    throw new ApiError(
      'Could not reach the Bhoomi Fitness server. Check your connection and try again.',
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

  if (!res.ok) {
    if (res.status === 401 && auth) {
      clearToken()
      unauthorizedListeners.forEach((fn) => fn())
    }
    const message =
      (data && (data.detail || data.message)) ||
      `Something went wrong (${res.status}). Please try again.`
    throw new ApiError(
      typeof message === 'string' ? message : 'Something went wrong. Please try again.',
      res.status,
      data
    )
  }

  return data
}

export const api = {
  // --- Member auth ---
  requestCode: (identifier) =>
    request('/api/auth/request-code', { method: 'POST', body: { identifier } }),
  verifyCode: (identifier, code) =>
    request('/api/auth/verify-code', { method: 'POST', body: { identifier, code } }),
  me: () => request('/api/auth/me', { auth: true }),
  updateMe: (name) => request('/api/auth/me', { method: 'PATCH', auth: true, body: { name } }),
  qrPayload: (signal) => request('/api/auth/qr-payload', { auth: true, signal }),

  // --- Workouts ---
  workoutLibrary: () => request('/api/workouts/library'),
  createSession: () => request('/api/workouts/sessions', { method: 'POST', auth: true, body: {} }),
  logSet: (sessionId, set) =>
    request(`/api/workouts/sessions/${sessionId}/sets`, {
      method: 'POST',
      auth: true,
      body: set,
    }),
  finishSession: (sessionId, summary) =>
    request(`/api/workouts/sessions/${sessionId}/finish`, {
      method: 'POST',
      auth: true,
      body: summary,
    }),
  workoutHistory: (months = 2) =>
    request(`/api/workouts/history?months=${months}`, { auth: true }),

  // --- Cafeteria ---
  cafeteriaMenu: () => request('/api/cafeteria/menu'),
  placeOrder: (items, notes) =>
    request('/api/cafeteria/orders', { method: 'POST', auth: true, body: { items, notes } }),
  myOrders: () => request('/api/cafeteria/orders/mine', { auth: true }),
  orderStatus: (orderId, signal) =>
    request(`/api/cafeteria/orders/${orderId}/status`, { auth: true, signal }),
}

export { ApiError, API_URL }
