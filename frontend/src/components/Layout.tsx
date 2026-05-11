import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../services/api'

type NavItem = {
  to: string
  icon: string
  label: string
}

const NAV: NavItem[] = [
  { to: '/dashboard',              icon: 'solar:home-2-linear',              label: 'Dashboard' },
  { to: '/clients',                icon: 'solar:users-group-rounded-linear', label: 'Clientes' },
  { to: '/processes',              icon: 'solar:document-text-linear',       label: 'Processos' },
  { to: '/financeiro',             icon: 'solar:dollar-circle-linear',       label: 'Financeiro' },
  { to: '/solicitacoes',           icon: 'solar:inbox-in-linear',            label: 'Solicitações' },
  { to: '/configuracoes/provedores', icon: 'solar:settings-linear',          label: 'Configurações' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    setSidebarOpen(false)
  }, [navigate])

  useEffect(() => {
    api.get<{ requests: unknown[] }>('/api/case-requests')
      .then(({ data }) => setAlertCount(data.requests.length))
      .catch(() => null)
  }, [])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const initial = user?.name?.charAt(0).toUpperCase() ?? '?'

  return (
    <div id="app-layout" className={sidebarOpen ? 'sidebar-enable' : ''}>

      {/* ── Topbar ──────────────────────────────────────────── */}
      <div className="topbar-custom">
        <div className="container-fluid">
          <div className="d-flex justify-content-between">

            <ul className="list-unstyled topnav-menu mb-0 d-flex align-items-center">
              <li>
                <button
                  type="button"
                  className="button-toggle-menu nav-link"
                  onClick={() => setSidebarOpen(o => !o)}
                >
                  <iconify-icon icon="solar:hamburger-menu-linear" style={{ fontSize: 22 }} className="align-middle text-dark" />
                </button>
              </li>
            </ul>

            <ul className="list-unstyled topnav-menu mb-0 d-flex align-items-center gap-2">

              {/* ── Notificações / Alertas ── */}
              <li className="dropdown notification-list topbar-dropdown">
                <a
                  className="nav-link dropdown-toggle"
                  data-bs-toggle="dropdown"
                  href="#"
                  role="button"
                  aria-expanded="false"
                  data-bs-auto-close="outside"
                >
                  <span className="position-relative d-inline-flex">
                    <iconify-icon icon="solar:bell-bing-bold-duotone" style={{ fontSize: 22 }} className="text-dark align-middle" />
                    {alertCount > 0 && (
                      <span
                        className="badge bg-danger position-absolute rounded-pill"
                        style={{ top: -6, right: -8, fontSize: 9, minWidth: 16, padding: '2px 4px', lineHeight: 1.4 }}
                      >
                        {alertCount}
                      </span>
                    )}
                  </span>
                </a>
                <div className="dropdown-menu dropdown-menu-end profile-dropdown" style={{ minWidth: 270 }}>
                  <div className="dropdown-item noti-title">
                    <p className="m-0 fs-14 fw-medium text-dark">Alertas do Sistema</p>
                  </div>
                  {alertCount > 0 ? (
                    <button
                      className="dropdown-item d-flex align-items-center gap-2 py-2"
                      onClick={() => navigate('/solicitacoes')}
                    >
                      <span className="bg-danger rounded-circle d-inline-block flex-shrink-0" style={{ width: 8, height: 8 }} />
                      <span className="fs-13">
                        {alertCount} solicitação{alertCount > 1 ? 'ões' : ''} de novo caso pendente{alertCount > 1 ? 's' : ''}
                      </span>
                    </button>
                  ) : (
                    <div className="dropdown-item text-muted fs-13 py-2">
                      <iconify-icon icon="solar:check-circle-linear" className="me-1 text-success" />
                      Nenhum alerta pendente
                    </div>
                  )}
                  <div className="dropdown-divider" />
                  <button
                    className="dropdown-item fs-13 text-center py-1"
                    onClick={() => navigate('/dashboard')}
                  >
                    Ver painel de alertas →
                  </button>
                </div>
              </li>

              {/* ── Perfil do usuário ── */}
              <li className="dropdown notification-list topbar-dropdown">
                <a
                  className="nav-link dropdown-toggle nav-user me-0 d-flex align-items-center gap-2"
                  href="#"
                  data-bs-toggle="dropdown"
                  role="button"
                  aria-expanded="false"
                >
                  <div
                    className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
                    style={{ width: 32, height: 32, fontSize: 13 }}
                  >
                    {initial}
                  </div>
                  <span className="d-none d-md-inline fs-14 text-dark">{user?.name}</span>
                </a>
                <div className="dropdown-menu dropdown-menu-end profile-dropdown">
                  <div className="dropdown-header noti-title border-bottom border-dashed d-flex align-items-center gap-2 pb-2">
                    <div
                      className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
                      style={{ width: 28, height: 28, fontSize: 12 }}
                    >
                      {initial}
                    </div>
                    <div className="overflow-hidden">
                      <h6 className="text-overflow m-0 fs-14">{user?.name}</h6>
                      <small className="text-muted">{user?.role}</small>
                    </div>
                  </div>
                  <button
                    className="dropdown-item notify-item border-bottom border-dashed"
                    onClick={() => navigate('/configuracoes/provedores')}
                  >
                    <iconify-icon icon="solar:user-bold-duotone" className="fs-18 align-middle me-1" />
                    <span>Minha Conta</span>
                  </button>
                  <button
                    className="dropdown-item notify-item border-bottom border-dashed"
                    onClick={() => navigate('/configuracoes/provedores')}
                  >
                    <iconify-icon icon="solar:settings-bold-duotone" className="fs-18 align-middle me-1" />
                    <span>Configurações</span>
                  </button>
                  <button className="dropdown-item notify-item text-danger" onClick={handleLogout}>
                    <iconify-icon icon="solar:logout-2-bold-duotone" className="fs-18 align-middle me-1" />
                    <span>Sair</span>
                  </button>
                </div>
              </li>

            </ul>
          </div>
        </div>
      </div>

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <div className="app-sidebar-menu">
        <div className="h-100" data-simplebar="init">
          <div id="sidebar-menu">

            <div className="logo-box">
              <NavLink to="/dashboard" className="logo logo-light">
                <span className="logo-lg">
                  <span className="text-white fw-bold fs-16">⚖️ JurisControl</span>
                </span>
                <span className="logo-sm">
                  <span className="text-white fw-bold fs-18">⚖️</span>
                </span>
              </NavLink>
            </div>

            <ul id="side-navbar">
              <li className="menu-title">Menu</li>
              {NAV.map(item => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) => `tp-link${isActive ? ' active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span className="nav-icon"><iconify-icon icon={item.icon} /></span>
                    <span className="sidebar-text">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>

          </div>
        </div>
      </div>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'rgba(0,0,0,.3)' }}
        />
      )}

      {/* ── Conteúdo das páginas ─────────────────────────────── */}
      <Outlet />

    </div>
  )
}
