import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, clearToken, getToken, onUnauthorized, setToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [member, setMember] = useState(null)
  const [initializing, setInitializing] = useState(true)
  const [authError, setAuthError] = useState(null)

  const refreshMe = useCallback(async () => {
    if (!getToken()) {
      setMember(null)
      return null
    }
    try {
      const data = await api.me()
      setMember(data)
      return data
    } catch (err) {
      if (err.status === 401) {
        setMember(null)
      }
      throw err
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function boot() {
      if (getToken()) {
        try {
          await refreshMe()
        } catch {
          // errors are surfaced by refreshMe's caller elsewhere / silently
          // fall back to logged-out state below.
        }
      }
      if (!cancelled) setInitializing(false)
    }
    boot()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return onUnauthorized(() => {
      setMember(null)
      setAuthError('Your session expired. Please log in again.')
    })
  }, [])

  const login = useCallback((token, memberData) => {
    setToken(token)
    setMember(memberData)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setMember(null)
  }, [])

  const updateName = useCallback(async (name) => {
    const updated = await api.updateMe(name)
    setMember(updated)
    return updated
  }, [])

  const value = useMemo(
    () => ({
      member,
      initializing,
      isAuthenticated: Boolean(member),
      authError,
      clearAuthError: () => setAuthError(null),
      login,
      logout,
      refreshMe,
      updateName,
    }),
    [member, initializing, authError, login, logout, refreshMe, updateName]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
