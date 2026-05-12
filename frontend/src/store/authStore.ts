import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../services/api'
import type { AuthUser, Role } from '../types/auth'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
  microsoftConnected: boolean
  googleConnected: boolean

  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshAccessToken: () => Promise<void>
  setTokensFromOAuth: (accessToken: string, refreshToken: string, role: Role, name: string) => void
  setProviderStatus: (microsoft: boolean, google: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: localStorage.getItem('access_token'),
      refreshToken: null,
      user: null,
      microsoftConnected: false,
      googleConnected: false,

      async login(email, password) {
        const { data } = await api.post('/auth/login', { email, password })
        const decoded = parseJwt(data.access_token)
        set({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          user: { id: decoded.id, email: decoded.email, role: data.role, name: data.name },
        })
        localStorage.setItem('access_token', data.access_token)
      },

      async register(name, email, password) {
        const { data } = await api.post('/auth/register', { name, email, password })
        const decoded = parseJwt(data.access_token)
        set({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          user: { id: decoded.id, email: decoded.email, role: data.role, name: data.name },
        })
        localStorage.setItem('access_token', data.access_token)
      },

      async logout() {
        await api.post('/auth/logout').catch(() => null)
        localStorage.removeItem('access_token')
        set({ accessToken: null, refreshToken: null, user: null })
      },

      async refreshAccessToken() {
        const { refreshToken } = get()
        if (!refreshToken) return

        const { data } = await api.post('/auth/refresh', { refresh_token: refreshToken })
        const decoded = parseJwt(data.access_token)
        set({
          accessToken: data.access_token,
          refreshToken: data.refresh_token ?? refreshToken,
          user: { id: decoded.id, email: decoded.email, role: decoded.role as Role, name: decoded.name },
        })
        localStorage.setItem('access_token', data.access_token)
      },

      setTokensFromOAuth(accessToken, refreshToken, role, name) {
        const decoded = parseJwt(accessToken)
        set({
          accessToken,
          refreshToken,
          user: { id: decoded.id, email: decoded.email, role, name },
        })
        localStorage.setItem('access_token', accessToken)
      },

      setProviderStatus(microsoft, google) {
        set({ microsoftConnected: microsoft, googleConnected: google })
      },
    }),
    {
      name: 'juriscontrol-auth',
      partialize: (state) => ({
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
)

function parseJwt(token: string): Record<string, string> {
  try {
    return JSON.parse(atob(token.split('.')[1]!)) as Record<string, string>
  } catch {
    return {}
  }
}
