import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler } from '../api/client.js'

const AuthContext = createContext(null)

export const SUPER_ADMIN_ROLES = ['head_trainer', 'owner']
// Who can use the Personal Trainer tab — trainers themselves, plus
// head_trainer/owner for oversight. Mirrors app.models.TRAINER_ROLES.
export const TRAINER_ROLES = ['trainer', 'head_trainer', 'owner']

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => getToken())
  const [staff, setStaff] = useState(null)
  const [initializing, setInitializing] = useState(true)
  const isAuthenticated = !!token
  const isSuperAdmin = !!staff && SUPER_ADMIN_ROLES.includes(staff.role)
  const isTrainer = !!staff && TRAINER_ROLES.includes(staff.role)

  const logout = useCallback(() => {
    setToken(null)
    setTokenState(null)
    setStaff(null)
  }, [])

  // Any 401 from the API client anywhere in the app clears the token and
  // sends staff back to the login screen.
  useEffect(() => {
    setUnauthorizedHandler(() => logout())
    return () => setUnauthorizedHandler(null)
  }, [logout])

  // On boot, if a token is already stored, fetch /me to recover the staff
  // object (name/identifier/role) so role-gated tabs render correctly after
  // a page refresh, not just right after login.
  useEffect(() => {
    let cancelled = false
    async function boot() {
      if (getToken()) {
        try {
          const me = await api.get('/api/staff/me')
          if (!cancelled) setStaff(me)
        } catch {
          if (!cancelled) logout()
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

  const requestCode = useCallback(async (identifier) => {
    return api.post('/api/staff/request-code', { identifier }, { auth: false })
  }, [])

  const verifyCode = useCallback(async (identifier, code) => {
    const data = await api.post('/api/staff/verify-code', { identifier, code }, { auth: false })
    if (!data?.access_token) {
      throw new Error('Login response did not include an access token.')
    }
    setToken(data.access_token)
    setTokenState(data.access_token)
    setStaff(data.staff)
    return data
  }, [])

  const value = useMemo(
    () => ({
      token,
      staff,
      isAuthenticated,
      isSuperAdmin,
      isTrainer,
      initializing,
      requestCode,
      verifyCode,
      logout,
    }),
    [token, staff, isAuthenticated, isSuperAdmin, isTrainer, initializing, requestCode, verifyCode, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
