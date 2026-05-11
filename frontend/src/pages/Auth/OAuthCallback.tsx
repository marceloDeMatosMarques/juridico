import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import type { Role } from '../../types/auth'

export default function OAuthCallback() {
  const navigate = useNavigate()
  const setTokensFromOAuth = useAuthStore(s => s.setTokensFromOAuth)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    const role = params.get('role')
    const name = params.get('name')

    if (access_token && refresh_token && role && name) {
      setTokensFromOAuth(access_token, refresh_token, role as Role, name)
      navigate('/dashboard', { replace: true })
    } else {
      navigate('/login', { replace: true })
    }
  }, [navigate, setTokensFromOAuth])

  return (
    <div className="d-flex align-items-center justify-content-center vh-100">
      <div className="text-center">
        <div className="spinner-border text-primary mb-2" role="status" />
        <p className="text-muted mb-0">Autenticando...</p>
      </div>
    </div>
  )
}
