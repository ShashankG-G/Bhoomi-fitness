import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler } from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => getToken())
  const isAuthenticated = !!token

  const logout = useCallback(() => {
    setToken(null)
    setTokenState(null)
  }, [])

  // Any 401 from the API client anywhere in the app clears the token and
  // sends staff back to the login screen.
  useEffect(() => {
    setUnauthorizedHandler(() => logout())
    return () => setUnauthorizedHandler(null)
  }, [logout])

  const login = useCallback(async (username, password) => {
    const data = await api.post(
      '/api/staff/login',
      { username, password },
      { auth: false }
    )
    if (!data?.access_token) {
      throw new Error('Login response did not include an access token.')
    }
    setToken(data.access_token)
    setTokenState(data.access_token)
    return data
  }, [])

  const value = useMemo(
    () => ({ token, isAuthenticated, login, logout }),
    [token, isAuthenticated, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
