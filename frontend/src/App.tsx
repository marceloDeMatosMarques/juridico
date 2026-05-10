import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
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
        <Route path="/login"         element={<Login />} />
        <Route path="/intake/:token" element={<IntakeForm />} />

        {/* Portal do cliente (layout próprio) */}
        <Route path="/portal/login" element={<PortalLogin />} />
        <Route path="/portal" element={<PortalLayout />}>
          <Route path="dashboard"     element={<PortalDashboard />} />
          <Route path="processos/:id" element={<PortalProcessDetails />} />
          <Route path="novo-caso"     element={<PortalNewCase />} />
          <Route path="senha"         element={<PortalChangePassword />} />
        </Route>

        {/* Área protegida — todas as rotas compartilham o Layout com sidebar */}
        <Route element={<AuthLayout />}>
          <Route path="/"                            element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"                   element={<Dashboard />} />
          <Route path="/clients"                     element={<ClientList />} />
          <Route path="/clients/new"                 element={<ClientForm />} />
          <Route path="/clients/:id"                 element={<ClientDetails />} />
          <Route path="/clients/:id/edit"            element={<ClientForm />} />
          <Route path="/clients/:id/intake"          element={<InternalIntakePage />} />
          <Route path="/processes"                   element={<ProcessList />} />
          <Route path="/processes/new"               element={<ProcessForm />} />
          <Route path="/processes/:id"               element={<ProcessDetails />} />
          <Route path="/processes/:id/edit"          element={<ProcessForm />} />
          <Route path="/processes/:id/petition"      element={<PetitionAssembler />} />
          <Route path="/processes/:id/videos"        element={<VideoManager />} />
          <Route path="/financeiro"                  element={<FinancialDashboard />} />
          <Route path="/solicitacoes"                element={<CaseRequests />} />
          <Route path="/configuracoes/provedores"    element={<Providers />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function AuthLayout() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Layout />
}
