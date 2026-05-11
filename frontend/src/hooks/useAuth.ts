import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const store = useAuthStore()
  return {
    user: store.user,
    isAuthenticated: !!store.user && !!store.accessToken,
    isAdvogado: store.user?.role === 'advogado',
    isAssistente: store.user?.role === 'assistente',
    isCliente: store.user?.role === 'cliente',
    microsoftConnected: store.microsoftConnected,
    googleConnected: store.googleConnected,
    login: store.login,
    register: store.register,
    logout: store.logout,
    refreshAccessToken: store.refreshAccessToken,
  }
}
