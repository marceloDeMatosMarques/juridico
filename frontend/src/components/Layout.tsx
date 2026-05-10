import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

type NavItem = {
  to: string
  icon: string
  label: string
}

const NAV: NavItem[] = [
  { to: '/dashboard',              icon: 'ri-dashboard-line',     label: 'Dashboard' },
  { to: '/clients',                icon: 'ri-user-3-line',        label: 'Clientes' },
  { to: '/processes',              icon: 'ri-file-text-line',     label: 'Processos' },
  { to: '/financeiro',             icon: 'ri-money-dollar-circle-line', label: 'Financeiro' },
  { to: '/solicitacoes',           icon: 'ri-mail-add-line',      label: 'Solicitações' },
  { to: '/configuracoes/provedores', icon: 'ri-settings-3-line', label: 'Configurações' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Fecha sidebar ao trocar de rota no mobile
  useEffect(() => {
    setSidebarOpen(false)
  }, [navigate])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

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
                  <i className="ri-menu-line fs-22 align-middle text-dark" />
                </button>
              </li>
            </ul>

            <ul className="list-unstyled topnav-menu mb-0 d-flex align-items-center gap-2">
              <li className="dropdown">
                <a
                  className="nav-link dropdown-toggle d-flex align-items-center gap-2"
                  href="#"
                  data-bs-toggle="dropdown"
                  role="button"
                >
                  <div
                    className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold"
                    style={{ width: 32, height: 32, fontSize: 13 }}
                  >
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="d-none d-md-inline fs-14 text-dark">{user?.name}</span>
                </a>
                <div className="dropdown-menu dropdown-menu-end profile-dropdown">
                  <div className="dropdown-header">
                    <h6 className="text-overflow m-0">{user?.name}</h6>
                    <small className="text-muted">{user?.role}</small>
                  </div>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item text-danger" onClick={handleLogout}>
                    <i className="ri-logout-box-r-line me-1" />
                    Sair
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
                    <span className="nav-icon"><i className={item.icon} /></span>
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
