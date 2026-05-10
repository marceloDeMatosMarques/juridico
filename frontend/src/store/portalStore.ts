import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../services/api'

interface PortalUser {
  id: string
  email: string
  name: string
  client_id: string
  password_changed: boolean
}

interface PortalState {
  accessToken: string | null
  refreshToken: string | null
  user: PortalUser | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setPasswordChanged: () => void
}

export const usePortalStore = create<PortalState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,

      async login(email, password) {
        const { data } = await api.post('/api/portal/login', { email, password })
        localStorage.setItem('portal_access_token', data.access_token)
        set({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          user: {
            id: parseJwt(data.access_token).id,
            email,
            name: data.name,
            client_id: data.client_id,
            password_changed: data.password_changed,
          },
        })
      },

      logout() {
        localStorage.removeItem('portal_access_token')
        set({ accessToken: null, refreshToken: null, user: null })
      },

      setPasswordChanged() {
        set((s) => s.user ? { user: { ...s.user, password_changed: true } } : {})
      },
    }),
    {
      name: 'juriscontrol-portal',
      partialize: (state) => ({ refreshToken: state.refreshToken, user: state.user }),
    }
  )
)

function parseJwt(token: string): Record<string, string> {
  try { return JSON.parse(atob(token.split('.')[1]!)) as Record<string, string> }
  catch { return {} }
}
