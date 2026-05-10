import { useEffect, useState, FormEvent } from 'react'
import { api } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import type { ProvidersStatus } from '../../types/auth'

type MonitoredDomain = {
  id: string
  court_name: string
  email_domain: string
  court_system: string
  state: string
  active: boolean
}

function CourtMonitoringCard() {
  const [enabled, setEnabled]   = useState(false)
  const [domains, setDomains]   = useState<MonitoredDomain[]>([])
  const [form, setForm]         = useState({ court_name: '', email_domain: '', court_system: 'pje', state: '' })
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    api.get<{ domains: MonitoredDomain[] }>('/api/court-monitoring')
      .then(({ data }) => setDomains(data.domains ?? []))
      .catch(() => null)
    api.get<{ auto_monitor_court_emails: boolean }>('/api/settings/providers')
      .then(({ data }) => setEnabled((data as any).auto_monitor_court_emails ?? false))
      .catch(() => null)
  }, [])

  async function toggleEnabled() {
    const next = !enabled
    setEnabled(next)
    await api.put('/api/court-monitoring/settings', { auto_monitor_court_emails: next }).catch(() => null)
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await api.post<MonitoredDomain>('/api/court-monitoring', form)
      setDomains(prev => [data, ...prev])
      setForm({ court_name: '', email_domain: '', court_system: 'pje', state: '' })
    } catch { alert('Erro ao adicionar domínio.') }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    await api.delete(`/api/court-monitoring/${id}`).catch(() => null)
    setDomains(prev => prev.filter(d => d.id !== id))
  }

  async function handleToggle(id: string) {
    const { data } = await api.patch<MonitoredDomain>(`/api/court-monitoring/${id}`).catch(() => ({ data: null }))
    if (data) setDomains(prev => prev.map(d => d.id === id ? data : d))
  }

  return (
    <div className="card border h-100">
      <div className="card-body">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="d-flex align-items-center">
            <i className="ri-notification-3-line me-2 text-primary fs-22" />
            <h6 className="mb-0 fw-semibold">Monitoramento de Tribunal</h6>
          </div>
          <div className="form-check form-switch mb-0">
            <input
              className="form-check-input"
              type="checkbox"
              checked={enabled}
              onChange={() => void toggleEnabled()}
              id="monitorToggle"
            />
            <label className="form-check-label fs-12" htmlFor="monitorToggle">
              {enabled ? 'Ativo' : 'Inativo'}
            </label>
          </div>
        </div>

        <p className="text-muted fs-12 mb-3">
          Monitora a caixa de entrada do Outlook em busca de e-mails dos tribunais cadastrados abaixo.
          Usa IA (Gemini) para extrair prazos e tipo de notificação automaticamente.
        </p>

        {/* Existing domains */}
        {domains.length > 0 && (
          <div className="mb-3">
            {domains.map(d => (
              <div key={d.id} className="d-flex align-items-center gap-2 py-1 border-bottom">
                <span className={`badge fs-10 ${d.active ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}`}>
                  {d.court_system.toUpperCase()}
                </span>
                <div className="flex-grow-1">
                  <span className="fs-13 fw-medium">{d.court_name}</span>
                  <span className="text-muted fs-12 ms-1">@{d.email_domain} · {d.state}</span>
                </div>
                <button className="btn btn-xs btn-outline-secondary" onClick={() => void handleToggle(d.id)} title={d.active ? 'Desativar' : 'Ativar'}>
                  {d.active ? '⏸' : '▶'}
                </button>
                <button className="btn btn-xs btn-outline-danger" onClick={() => void handleDelete(d.id)} title="Remover">
                  <i className="ri-delete-bin-line" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add domain form */}
        <form onSubmit={e => void handleAdd(e)}>
          <div className="row g-2">
            <div className="col-12">
              <input
                className="form-control form-control-sm"
                placeholder="Nome do tribunal (ex: TJRJ)"
                value={form.court_name}
                onChange={e => setForm(p => ({ ...p, court_name: e.target.value }))}
                required
              />
            </div>
            <div className="col-md-6">
              <input
                className="form-control form-control-sm"
                placeholder="Domínio do e-mail (ex: pje.tjrj.jus.br)"
                value={form.email_domain}
                onChange={e => setForm(p => ({ ...p, email_domain: e.target.value }))}
                required
              />
            </div>
            <div className="col-md-3">
              <select
                className="form-select form-select-sm"
                value={form.court_system}
                onChange={e => setForm(p => ({ ...p, court_system: e.target.value }))}
              >
                <option value="pje">PJe</option>
                <option value="eproc">eProc</option>
                <option value="projudi">Projudi</option>
                <option value="saj">SAJ</option>
                <option value="esaj">eSAJ</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            <div className="col-md-3">
              <input
                className="form-control form-control-sm text-uppercase"
                placeholder="UF (ex: RJ)"
                maxLength={2}
                value={form.state}
                onChange={e => setForm(p => ({ ...p, state: e.target.value.toUpperCase() }))}
                required
              />
            </div>
          </div>
          <button className="btn btn-sm btn-outline-primary mt-2" type="submit" disabled={saving}>
            {saving ? 'Adicionando...' : '+ Adicionar domínio'}
          </button>
        </form>
      </div>
    </div>
  )
}

type WAConfig = {
  evolution_api_url: string
  evolution_api_key: string
  evolution_instance_name: string
  connected: boolean
  instance_id: string | null
}

function WhatsAppCard() {
  const [config, setConfig] = useState<WAConfig | null>(null)
  const [form, setForm] = useState({ evolution_api_url: '', evolution_api_key: '', evolution_instance_name: 'juriscontrol' })
  const [qrcode, setQrcode] = useState<string | null>(null)
  const [state, setState] = useState<string>('close')
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [polling, setPolling] = useState(false)

  useEffect(() => {
    api.get<WAConfig>('/api/whatsapp/config')
      .then(({ data }) => {
        setConfig(data)
        setForm({
          evolution_api_url:       data.evolution_api_url,
          evolution_api_key:       data.evolution_api_key === '***' ? '' : data.evolution_api_key,
          evolution_instance_name: data.evolution_instance_name,
        })
        setState(data.connected ? 'open' : 'close')
      })
      .catch(() => null)
  }, [])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put('/api/whatsapp/config', form)
      const { data } = await api.get<WAConfig>('/api/whatsapp/config')
      setConfig(data)
    } catch { alert('Erro ao salvar configuração.') }
    finally { setSaving(false) }
  }

  async function handleConnect() {
    setConnecting(true)
    setQrcode(null)
    try {
      const { data } = await api.post<{ qrcode: string | null }>('/api/whatsapp/connect')
      if (data.qrcode) {
        setQrcode(data.qrcode)
        setState('connecting')
        startPolling()
      }
    } catch { alert('Erro ao conectar. Verifique as configurações da Evolution API.') }
    finally { setConnecting(false) }
  }

  function startPolling() {
    if (polling) return
    setPolling(true)
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get<{ state: string }>('/api/whatsapp/status')
        setState(data.state)
        if (data.state === 'open') {
          setQrcode(null)
          setConfig(prev => prev ? { ...prev, connected: true } : prev)
          clearInterval(interval)
          setPolling(false)
        }
      } catch {
        clearInterval(interval)
        setPolling(false)
      }
    }, 4000)
    setTimeout(() => { clearInterval(interval); setPolling(false) }, 120000)
  }

  async function handleDisconnect() {
    await api.post('/api/whatsapp/disconnect').catch(() => null)
    setConfig(prev => prev ? { ...prev, connected: false } : prev)
    setState('close')
    setQrcode(null)
  }

  return (
    <div className="card border h-100">
      <div className="card-body">
        <div className="d-flex align-items-center mb-2">
          <i className="ri-whatsapp-line me-2 text-success fs-22" />
          <h6 className="mb-0 fw-semibold">WhatsApp (Evolution API)</h6>
        </div>

        {config?.connected || state === 'open' ? (
          <>
            <span className="badge bg-success-subtle text-success mb-2">● Conectado</span>
            {config?.instance_id && <p className="text-muted fs-12 mb-2">Instância: {config.instance_id}</p>}
            <button className="btn btn-sm btn-outline-danger" onClick={() => void handleDisconnect()}>Desconectar</button>
          </>
        ) : (
          <>
            {state === 'connecting' ? (
              <span className="badge bg-warning-subtle text-warning mb-2">⏳ Aguardando scan</span>
            ) : (
              <span className="badge bg-secondary-subtle text-secondary mb-2">○ Desconectado</span>
            )}

            {qrcode && (
              <div className="text-center my-3">
                <p className="text-muted fs-12 mb-2">Escaneie com o WhatsApp:</p>
                <img
                  src={qrcode.startsWith('data:') ? qrcode : `data:image/png;base64,${qrcode}`}
                  alt="QR Code WhatsApp"
                  style={{ width: 200, height: 200, border: '4px solid #25d366', borderRadius: 8 }}
                />
              </div>
            )}

            <form onSubmit={e => void handleSave(e)} className="mt-2">
              <div className="mb-2">
                <label className="form-label fs-12">URL da Evolution API *</label>
                <input
                  className="form-control form-control-sm"
                  placeholder="https://evolution.seudominio.com"
                  value={form.evolution_api_url}
                  onChange={e => setForm(p => ({ ...p, evolution_api_url: e.target.value }))}
                  required
                />
              </div>
              <div className="mb-2">
                <label className="form-label fs-12">API Key *</label>
                <input
                  className="form-control form-control-sm"
                  type="password"
                  placeholder="••••••••"
                  value={form.evolution_api_key}
                  onChange={e => setForm(p => ({ ...p, evolution_api_key: e.target.value }))}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label fs-12">Nome da instância</label>
                <input
                  className="form-control form-control-sm"
                  value={form.evolution_instance_name}
                  onChange={e => setForm(p => ({ ...p, evolution_instance_name: e.target.value }))}
                />
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-outline-secondary" type="submit" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  className="btn btn-sm btn-success"
                  type="button"
                  disabled={connecting || !form.evolution_api_url || !form.evolution_api_key}
                  onClick={() => void handleConnect()}
                >
                  {connecting ? 'Conectando...' : 'Conectar'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function Providers() {
  const setProviderStatus = useAuthStore((s) => s.setProviderStatus)
  const [status, setStatus] = useState<ProvidersStatus | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    api.get<ProvidersStatus>('/api/settings/providers')
      .then(({ data }) => {
        setStatus(data)
        setProviderStatus(data.microsoft.conectado, data.google.conectado)
      })
      .catch(() => setErro('Erro ao carregar status dos provedores.'))
      .finally(() => setCarregando(false))
  }, [setProviderStatus])

  async function desconectar(provider: 'microsoft' | 'google') {
    await api.post(`/auth/${provider}/disconnect`)
    const { data } = await api.get<ProvidersStatus>('/api/settings/providers')
    setStatus(data)
    setProviderStatus(data.microsoft.conectado, data.google.conectado)
  }

  function atualizarPreferencia(campo: 'storage_provider' | 'calendar_provider', valor: string) {
    api.put('/api/settings/providers', { [campo]: valor })
      .then(() => setStatus((prev) => prev ? { ...prev, [campo]: valor } : prev))
      .catch(() => null)
  }

  if (carregando) return <div className="text-muted">Carregando...</div>
  if (erro) return <div className="alert alert-danger">{erro}</div>
  if (!status) return null

  return (
    <div>
      <h5 className="mb-3">Provedores de Serviço</h5>

      <div className="row g-3 mb-4">
        {/* WhatsApp */}
        <div className="col-12">
          <WhatsAppCard />
        </div>

        {/* Court Monitoring */}
        <div className="col-12">
          <CourtMonitoringCard />
        </div>

        {/* Microsoft OneDrive / Outlook */}
        <div className="col-md-6">
          <div className="card border h-100">
            <div className="card-body">
              <div className="d-flex align-items-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 23 23" className="me-2 flex-shrink-0">
                  <path fill="#f3f3f3" d="M0 0h23v23H0z"/>
                  <path fill="#f35325" d="M1 1h10v10H1z"/>
                  <path fill="#81bc06" d="M12 1h10v10H12z"/>
                  <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                  <path fill="#ffba08" d="M12 12h10v10H12z"/>
                </svg>
                <h6 className="mb-0 fw-semibold">Microsoft OneDrive + Outlook</h6>
              </div>

              {status.microsoft.conectado ? (
                <>
                  <span className="badge bg-success-subtle text-success mb-2">● Conectado</span>
                  <div className="mb-3">
                    <label className="form-label fs-13">Preferência de armazenamento</label>
                    <select
                      className="form-select form-select-sm"
                      value={status.storage_provider}
                      onChange={(e) => atualizarPreferencia('storage_provider', e.target.value)}
                    >
                      <option value="onedrive">Usar apenas OneDrive</option>
                      <option value="ambos">Usar ambos (OneDrive + Google Drive)</option>
                    </select>
                  </div>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => desconectar('microsoft')}
                  >
                    Desconectar
                  </button>
                </>
              ) : (
                <>
                  <span className="badge bg-secondary-subtle text-secondary mb-3">○ Desconectado</span>
                  <div>
                    <a href="/auth/microsoft" className="btn btn-sm btn-outline-primary">
                      Conectar com Microsoft
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Google Drive / Calendar */}
        <div className="col-md-6">
          <div className="card border h-100">
            <div className="card-body">
              <div className="d-flex align-items-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 48 48" className="me-2 flex-shrink-0">
                  <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                  <path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/>
                  <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                  <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                </svg>
                <h6 className="mb-0 fw-semibold">Google Drive + Calendar</h6>
              </div>

              {status.google.conectado ? (
                <>
                  <span className="badge bg-success-subtle text-success mb-1">● Conectado</span>
                  {status.google.email && (
                    <p className="text-muted fs-13 mb-2">{status.google.email}</p>
                  )}
                  <div className="mb-3">
                    <label className="form-label fs-13">Preferência de calendário</label>
                    <select
                      className="form-select form-select-sm"
                      value={status.calendar_provider}
                      onChange={(e) => atualizarPreferencia('calendar_provider', e.target.value)}
                    >
                      <option value="google">Usar apenas Google Calendar</option>
                      <option value="outlook">Usar apenas Outlook</option>
                      <option value="ambos">Usar ambos</option>
                    </select>
                  </div>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => desconectar('google')}
                  >
                    Desconectar
                  </button>
                </>
              ) : (
                <>
                  <span className="badge bg-secondary-subtle text-secondary mb-3">○ Desconectado</span>
                  <div>
                    <a href="/auth/google" className="btn btn-sm btn-outline-danger">
                      Conectar com Google
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
