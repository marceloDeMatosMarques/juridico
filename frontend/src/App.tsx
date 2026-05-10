import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Auth/Login'
import Providers from './pages/Settings/Providers'
import ClientList from './pages/Clients/ClientList'
import ClientForm from './pages/Clients/ClientForm'
import ClientDetails from './pages/Clients/ClientDetails'
import InternalIntakePage from './pages/Clients/InternalIntakePage'
import IntakeForm from './pages/Intake/IntakeForm'
import PetitionAssembler from './pages/Processes/PetitionAssembler'
import ProcessList from './pages/Processes/ProcessList'
import ProcessForm from './pages/Processes/ProcessForm'
import ProcessDetails from './pages/Processes/ProcessDetails'
import VideoManager from './pages/Processes/VideoManager'
import FinancialDashboard from './pages/Financial/FinancialDashboard'
import Dashboard from './pages/Dashboard/Dashboard'
import CaseRequests from './pages/CaseRequests/CaseRequests'
import PortalLogin from './pages/Portal/PortalLogin'
import PortalLayout from './pages/Portal/PortalLayout'
import PortalDashboard from './pages/Portal/PortalDashboard'
import PortalProcessDetails from './pages/Portal/PortalProcessDetails'
import PortalNewCase from './pages/Portal/PortalNewCase'
import PortalChangePassword from './pages/Portal/PortalChangePassword'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Públicas */}
        <Route path="/login"          element={<Login />} />
        <Route path="/intake/:token"  element={<IntakeForm />} />

        {/* Protegidas */}
        <Route path="/"                               element={<PrivateRoute><Navigate to="/dashboard" replace /></PrivateRoute>} />
        <Route path="/dashboard"                      element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/clients"                        element={<PrivateRoute><ClientList /></PrivateRoute>} />
        <Route path="/clients/new"                    element={<PrivateRoute><ClientForm /></PrivateRoute>} />
        <Route path="/clients/:id"                    element={<PrivateRoute><ClientDetails /></PrivateRoute>} />
        <Route path="/clients/:id/edit"               element={<PrivateRoute><ClientForm /></PrivateRoute>} />
        <Route path="/clients/:id/intake"             element={<PrivateRoute><InternalIntakePage /></PrivateRoute>} />
        <Route path="/processes"                          element={<PrivateRoute><ProcessList /></PrivateRoute>} />
        <Route path="/processes/new"                      element={<PrivateRoute><ProcessForm /></PrivateRoute>} />
        <Route path="/processes/:id"                      element={<PrivateRoute><ProcessDetails /></PrivateRoute>} />
        <Route path="/processes/:id/edit"                 element={<PrivateRoute><ProcessForm /></PrivateRoute>} />
        <Route path="/processes/:id/petition"             element={<PrivateRoute><PetitionAssembler /></PrivateRoute>} />
        <Route path="/processes/:id/videos"              element={<PrivateRoute><VideoManager /></PrivateRoute>} />
        <Route path="/financeiro"                         element={<PrivateRoute><FinancialDashboard /></PrivateRoute>} />
        <Route path="/solicitacoes"                       element={<PrivateRoute><CaseRequests /></PrivateRoute>} />
        <Route path="/configuracoes/provedores"        element={<PrivateRoute><SettingsProvidersPage /></PrivateRoute>} />

        {/* Portal do cliente (layout separado) */}
        <Route path="/portal/login"  element={<PortalLogin />} />
        <Route path="/portal" element={<PortalLayout />}>
          <Route path="dashboard"    element={<PortalDashboard />} />
          <Route path="processos/:id" element={<PortalProcessDetails />} />
          <Route path="novo-caso"    element={<PortalNewCase />} />
          <Route path="senha"        element={<PortalChangePassword />} />
        </Route>

        <Route path="*"                               element={<PlaceholderPage title="Página não encontrada" />} />
      </Routes>
    </BrowserRouter>
  )
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function SettingsProvidersPage() {
  return (
    <div id="app-layout">
      <div className="content-page">
        <div className="content">
          <div className="container-fluid">
            <div className="row">
              <div className="col-12"><Providers /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div id="app-layout">
      <div className="content-page">
        <div className="content">
          <div className="container-fluid">
            <div className="row">
              <div className="col-12">
                <div className="card">
                  <div className="card-body">
                    <h4 className="header-title">{title}</h4>
                    <p className="text-muted">JurisControl — Sistema de Gestão Jurídica</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
