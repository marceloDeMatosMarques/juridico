import { Navigate, Outlet } from 'react-router-dom'
import { usePortalStore } from '../../store/portalStore'

export default function PortalLayout() {
  const { user, logout } = usePortalStore()

  if (!user) return <Navigate to="/portal/login" replace />

  return (
    <div className="min-vh-100 bg-light">
      <nav className="navbar navbar-light bg-white border-bottom px-3 py-2">
        <span className="navbar-brand fs-16 fw-bold">⚖️ Portal do Cliente</span>
        <div className="d-flex align-items-center gap-3">
          <span className="text-muted fs-13">{user.name}</span>
          <button className="btn btn-outline-secondary btn-sm" onClick={logout}>Sair</button>
        </div>
      </nav>

      <div className="container py-4" style={{ maxWidth: 860 }}>
        {!user.password_changed && (
          <div className="alert alert-warning fs-13 d-flex align-items-center gap-2 mb-4">
            <span>🔑</span>
            <span>Por segurança, <a href="/portal/senha">altere sua senha</a> no primeiro acesso.</span>
          </div>
        )}
        <Outlet />
      </div>
    </div>
  )
}
