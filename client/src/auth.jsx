import { createContext, useContext, useState, useCallback } from 'react'
import { api, getToken, setToken, decodeUserId } from './api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setTok] = useState(() => getToken())
  const userId = token ? decodeUserId(token) : null

  const login = useCallback(async (email, password) => {
    const { token } = await api.login({ email, password })
    setToken(token)
    setTok(token)
  }, [])

  const register = useCallback(async (email, password, name) => {
    await api.register({ email, password, name })
    // Registration does not return a token — log in immediately after.
    const { token } = await api.login({ email, password })
    setToken(token)
    setTok(token)
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setTok(null)
  }, [])

  return (
    <AuthContext.Provider value={{ token, userId, isAuthed: !!token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
