import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../services/api'

// ─── Types ───────────────────────────────────────────────────────────────────

type Cards = {
  total_processes: number
  active_processes: number
  hearings_this_week: number
  honorarios_pendentes: number
  urgent_notifications: number
}

type Hearing = {
  id: string
  title: string
  hearing_date: string
  hearing_time: string
  hearing_type: string
  case_title: string
}

type StatusGroup = { status: string; count: number }
type RevenueMonth = { month: string; total: number }

type Alert = {
  overdue_deadlines: Array<{ id: string; case_title: string; pending_deadline: string }>
  overdue_installments: Array<{ id: string; description: string; total_value: string; due_date: string; process: { case_title: string } }>
  urgent_notifications: Array<{ id: string; original_email_subject: string | null; parsed_content: Record<string, unknown> | null; process: { case_title: string } }>
}

type Process = { id: string; case_title: string; status: string; updated_at: string; client: { full_name: string } }

type DashboardData = {
  cards: Cards
  upcoming_hearings: Hearing[]
  processes_by_status: StatusGroup[]
  revenue_by_month: RevenueMonth[]
  alerts: Alert
  recent_processes: Process[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  aberto: 'Aberto', em_andamento: 'Em andamento', aguardando_audiencia: 'Aguardando',
  encerrado: 'Encerrado', ganho: 'Ganho', perdido: 'Perdido', acordo: 'Acordo', arquivado: 'Arquivado',
}

const STATUS_COLOR: Record<string, string> = {
  aberto: '#0d6efd', em_andamento: '#0dcaf0', aguardando_audiencia: '#ffc107',
  ganho: '#198754', perdido: '#dc3545', acordo: '#20c997', encerrado: '#6c757d', arquivado: '#adb5bd',
}

const HEARING_ICON: Record<string, string> = {
  audiencia_instrucao: '⚖️', audiencia_conciliacao: '🤝', audiencia_julgamento: '🏛️',
  reuniao_cliente: '👤', prazo_processual: '📅', diligencia: '🔍', pericia: '🔬',
}

function brl(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}


function monthLabel(yyyyMM: string) {
  const [y, m] = yyyyMM.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('pt-BR', { month: 'short' })
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ icon, label, value, colorKey, onClick }: {
  icon: string; label: string; value: string | number; colorKey: string; onClick?: () => void
}) {
  return (
    <div
      className="card overflow-hidden h-100"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : undefined }}
    >
      <div className="card-body">
        <div className="d-flex align-items-center gap-3">
          <div className={`p-2 bg-${colorKey}-subtle rounded-2 border-top border-${colorKey} shadow-sm flex-shrink-0`}>
            <iconify-icon icon={icon} className={`align-middle fs-26 text-${colorKey}`} />
          </div>
          <div className="d-flex flex-column">
            <div className="fs-14 fw-normal text-dark mb-1">{label}</div>
            <div className={`fs-18 fw-medium text-${colorKey} mb-0`}>{value}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniCalendar({ hearings }: { hearings: Hearing[] }) {
  const days: Record<string, Hearing[]> = {}
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    days[key] = []
  }
  for (const h of hearings) {
    const key = new Date(h.hearing_date).toISOString().slice(0, 10)
    if (key in days) days[key]!.push(h)
  }

  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body">
        <h6 className="card-title mb-3">Próximos 7 dias</h6>
        <div className="d-flex gap-1 overflow-auto pb-1">
          {Object.entries(days).map(([date, items]) => {
            const d   = new Date(date + 'T00:00:00')
            const isToday = date === new Date().toISOString().slice(0, 10)
            return (
              <div
                key={date}
                className="flex-shrink-0 text-center rounded p-2"
                style={{ minWidth: 72, background: isToday ? '#e8f0fe' : '#f8f9fa', border: isToday ? '1px solid #0d6efd' : '1px solid #dee2e6' }}
              >
                <div className="fs-11 text-muted text-uppercase fw-semibold">
                  {d.toLocaleDateString('pt-BR', { weekday: 'short' })}
                </div>
                <div className={`fs-18 fw-bold ${isToday ? 'text-primary' : ''}`}>
                  {d.getDate()}
                </div>
                {items.length > 0 ? (
                  items.map(h => (
                    <div key={h.id} className="mt-1" title={`${h.title} — ${h.case_title}`}>
                      <div className="fs-14">{HEARING_ICON[h.hearing_type] ?? '📌'}</div>
                      <div className="fs-10 text-truncate text-muted">{h.hearing_time}</div>
                    </div>
                  ))
                ) : (
                  <div className="mt-2 fs-12 text-muted">—</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StatusChart({ groups }: { groups: StatusGroup[] }) {
  const total = groups.reduce((s, g) => s + g.count, 0) || 1
  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body">
        <h6 className="card-title mb-3">Processos por Status</h6>
        {groups.length === 0
          ? <p className="text-muted fs-13">Nenhum processo.</p>
          : groups.sort((a, b) => b.count - a.count).map(g => (
            <div key={g.status} className="mb-2">
              <div className="d-flex justify-content-between fs-12 mb-1">
                <span>{STATUS_LABEL[g.status] ?? g.status}</span>
                <span className="fw-medium">{g.count}</span>
              </div>
              <div className="progress" style={{ height: 8 }}>
                <div
                  className="progress-bar"
                  style={{ width: `${(g.count / total) * 100}%`, background: STATUS_COLOR[g.status] ?? '#6c757d' }}
                />
              </div>
            </div>
          ))
        }
      </div>
    </div>
  )
}

function RevenueChart({ months }: { months: RevenueMonth[] }) {
  const max = Math.max(...months.map(m => m.total), 1)
  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body">
        <h6 className="card-title mb-3">Receita Recebida (6 meses)</h6>
        <div className="d-flex align-items-end gap-2" style={{ height: 120 }}>
          {months.map(m => (
            <div key={m.month} className="flex-grow-1 d-flex flex-column align-items-center">
              <div className="fs-10 text-muted mb-1">{m.total > 0 ? brl(m.total).replace('R$ ', '') : ''}</div>
              <div
                className="w-100 rounded-top"
                style={{
                  height: `${Math.max((m.total / max) * 90, m.total > 0 ? 6 : 2)}px`,
                  background: m.total > 0 ? '#198754' : '#dee2e6',
                  transition: 'height .3s',
                }}
              />
              <div className="fs-11 text-muted mt-1 text-capitalize">{monthLabel(m.month)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AlertsPanel({ alerts }: { alerts: Alert }) {
  const navigate = useNavigate()
  const total = alerts.overdue_deadlines.length + alerts.overdue_installments.length + alerts.urgent_notifications.length
  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body">
        <h6 className="card-title mb-3">
          Alertas
          {total > 0 && <span className="badge bg-danger ms-2">{total}</span>}
        </h6>
        {total === 0 && <p className="text-success fs-13">✓ Nenhum alerta pendente.</p>}

        {alerts.overdue_deadlines.map(a => (
          <div key={a.id} className="d-flex align-items-start gap-2 mb-2 p-2 rounded bg-danger-subtle">
            <span className="fs-16 flex-shrink-0">⏰</span>
            <div className="flex-grow-1 overflow-hidden">
              <div className="fs-12 fw-medium text-truncate">{a.case_title}</div>
              <div className="fs-11 text-danger">Prazo vencido: {new Date(a.pending_deadline).toLocaleDateString('pt-BR')}</div>
            </div>
            <button className="btn btn-xs btn-outline-danger flex-shrink-0" onClick={() => navigate(`/processes/${a.id}`)}>→</button>
          </div>
        ))}

        {alerts.overdue_installments.map(a => (
          <div key={a.id} className="d-flex align-items-start gap-2 mb-2 p-2 rounded bg-warning-subtle">
            <span className="fs-16 flex-shrink-0">💰</span>
            <div className="flex-grow-1 overflow-hidden">
              <div className="fs-12 fw-medium text-truncate">{a.process.case_title}</div>
              <div className="fs-11 text-warning-emphasis">{a.description} — {brl(Number(a.total_value))} venceu em {new Date(a.due_date).toLocaleDateString('pt-BR')}</div>
            </div>
          </div>
        ))}

        {alerts.urgent_notifications.map(a => (
          <div key={a.id} className="d-flex align-items-start gap-2 mb-2 p-2 rounded" style={{ background: 'rgba(99,102,241,.08)' }}>
            <span className="fs-16 flex-shrink-0">📬</span>
            <div className="flex-grow-1 overflow-hidden">
              <div className="fs-12 fw-medium text-truncate">{a.process.case_title}</div>
              <div className="fs-11 text-truncate" style={{ color: '#6366f1' }}>
                {(a.parsed_content?.summary as string | undefined) ?? a.original_email_subject ?? 'Notificação urgente'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData]                   = useState<DashboardData | null>(null)
  const [loading, setLoading]             = useState(true)
  const [pendingRequests, setPendingRequests] = useState(0)

  useEffect(() => {
    api.get<DashboardData>('/api/dashboard')
      .then(({ data }) => setData(data))
      .catch(() => null)
      .finally(() => setLoading(false))
    api.get<{ requests: unknown[] }>('/api/case-requests')
      .then(({ data }) => setPendingRequests(data.requests.length))
      .catch(() => null)
  }, [])

  if (loading) return (
    <div className="content-page">
      <div className="content d-flex justify-content-center align-items-center" style={{ minHeight: 300 }}>
        <div className="spinner-border text-primary" />
      </div>
    </div>
  )

  if (!data) return null

  return (
    <div className="content-page">
      <div className="content">
        <div className="container-fluid">

          <div className="row mb-3">
            <div className="col-12">
              <h4 className="page-title mb-0">Dashboard</h4>
            </div>
          </div>

          {/* Stat cards */}
          <div className="row g-3 mb-4">
            <div className="col-md-6 col-xxl">
              <StatCard icon="solar:document-text-broken" label="Total Processos" value={data.cards.total_processes} colorKey="secondary" onClick={() => navigate('/processes')} />
            </div>
            <div className="col-md-6 col-xxl">
              <StatCard icon="solar:bolt-circle-broken" label="Processos Ativos" value={data.cards.active_processes} colorKey="primary" onClick={() => navigate('/processes')} />
            </div>
            <div className="col-md-6 col-xxl">
              <StatCard icon="solar:calendar-mark-broken" label="Audiências (7 dias)" value={data.cards.hearings_this_week} colorKey="info" />
            </div>
            <div className="col-md-6 col-xxl">
              <StatCard icon="solar:dollar-circle-broken" label="A Receber" value={brl(data.cards.honorarios_pendentes)} colorKey="warning" onClick={() => navigate('/financeiro')} />
            </div>
            <div className="col-md-6 col-xxl">
              <StatCard icon="solar:bell-bing-broken" label="Notif. Urgentes" value={data.cards.urgent_notifications} colorKey="danger" />
            </div>
            {pendingRequests > 0 && (
              <div className="col-md-6 col-xxl">
                <StatCard icon="solar:inbox-in-broken" label="Novos Casos" value={pendingRequests} colorKey="success" onClick={() => navigate('/solicitacoes')} />
              </div>
            )}
          </div>

          {/* Mini calendar + alerts */}
          <div className="row g-3 mb-4">
            <div className="col-lg-7">
              <MiniCalendar hearings={data.upcoming_hearings} />
            </div>
            <div className="col-lg-5">
              <AlertsPanel alerts={data.alerts} />
            </div>
          </div>

          {/* Charts */}
          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <StatusChart groups={data.processes_by_status} />
            </div>
            <div className="col-md-6">
              <RevenueChart months={data.revenue_by_month} />
            </div>
          </div>

          {/* Recent processes */}
          <div className="row">
            <div className="col-12">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="card-title mb-0">Processos Recentes</h6>
                    <button className="btn btn-xs btn-outline-primary" onClick={() => navigate('/processes')}>Ver todos</button>
                  </div>
                  {data.recent_processes.length === 0
                    ? <p className="text-muted fs-13">Nenhum processo cadastrado.</p>
                    : (
                      <div className="table-responsive">
                        <table className="table table-sm table-hover mb-0">
                          <thead className="table-light">
                            <tr>
                              <th className="fs-12">Caso</th>
                              <th className="fs-12">Cliente</th>
                              <th className="fs-12">Status</th>
                              <th className="fs-12">Atualizado</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {data.recent_processes.map(p => (
                              <tr key={p.id}>
                                <td className="fs-13">{p.case_title}</td>
                                <td className="fs-12 text-muted">{p.client.full_name}</td>
                                <td>
                                  <span
                                    className="badge fs-10"
                                    style={{ background: STATUS_COLOR[p.status] ?? '#6c757d', color: '#fff' }}
                                  >
                                    {STATUS_LABEL[p.status] ?? p.status}
                                  </span>
                                </td>
                                <td className="fs-12 text-muted text-nowrap">
                                  {new Date(p.updated_at).toLocaleDateString('pt-BR')}
                                </td>
                                <td>
                                  <button className="btn btn-xs btn-outline-secondary" onClick={() => navigate(`/processes/${p.id}`)}>→</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  }
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
