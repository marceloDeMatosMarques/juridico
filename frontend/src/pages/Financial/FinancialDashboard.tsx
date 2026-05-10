import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../services/api'

type Process = { id: string; case_title: string; process_number: string | null }

type Installment = {
  id: string
  installment_number: number
  value: string
  due_date: string
  paid_date: string | null
  status: string
}

type FinancialRecord = {
  id: string
  process_id: string
  process: Process
  record_type: string
  description: string
  total_value: string
  payment_status: string
  payment_type: string
  installments_total: number
  installments_paid: number
  due_date: string | null
  paid_date: string | null
  installments: Installment[]
}

type Dashboard = {
  records: FinancialRecord[]
  totalPendente: number
  totalPagoMes: number
  totalGeral: number
  overdueCount: number
}

const TYPE_LABEL: Record<string, string> = {
  honorario: 'Honorário', despesa: 'Despesa', reembolso: 'Reembolso', honorario_exito: 'Êxito',
}

const STATUS_BADGE: Record<string, string> = {
  pendente:  'bg-warning-subtle text-warning',
  parcial:   'bg-info-subtle text-info',
  pago:      'bg-success-subtle text-success',
  cancelado: 'bg-secondary-subtle text-secondary',
  atrasado:  'bg-danger-subtle text-danger',
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente', parcial: 'Parcial', pago: 'Pago', cancelado: 'Cancelado', atrasado: 'Atrasado',
}

function brl(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function isOverdue(r: FinancialRecord) {
  return (r.payment_status === 'pendente' || r.payment_status === 'parcial') &&
    r.due_date && new Date(r.due_date) < new Date()
}

export default function FinancialDashboard() {
  const navigate = useNavigate()
  const [data, setData]       = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('todos')

  useEffect(() => {
    api.get<Dashboard>('/api/financial/dashboard')
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="content-page"><div className="content p-4"><div className="spinner-border text-primary" /></div></div>
  )

  if (!data) return null

  const filtered = filter === 'todos'
    ? data.records
    : filter === 'atrasados'
    ? data.records.filter(r => isOverdue(r))
    : data.records.filter(r => r.payment_status === filter)

  return (
    <div className="content-page">
      <div className="content">
        <div className="container-fluid">

          <div className="row">
            <div className="col-12">
              <div className="page-title-box">
                <h4 className="page-title mb-0">Financeiro</h4>
              </div>
            </div>
          </div>

          {/* Summary cards */}
          <div className="row g-3 mb-4">
            <div className="col-sm-6 col-xl-3">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <div className="text-muted fs-13 mb-1">A Receber</div>
                  <div className="fs-22 fw-bold text-warning">{brl(data.totalPendente)}</div>
                </div>
              </div>
            </div>
            <div className="col-sm-6 col-xl-3">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <div className="text-muted fs-13 mb-1">Recebido (mês)</div>
                  <div className="fs-22 fw-bold text-success">{brl(data.totalPagoMes)}</div>
                </div>
              </div>
            </div>
            <div className="col-sm-6 col-xl-3">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <div className="text-muted fs-13 mb-1">Vencidos</div>
                  <div className="fs-22 fw-bold text-danger">{data.overdueCount}</div>
                </div>
              </div>
            </div>
            <div className="col-sm-6 col-xl-3">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <div className="text-muted fs-13 mb-1">Total Geral</div>
                  <div className="fs-22 fw-bold">{brl(data.totalGeral)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Filter + Table */}
          <div className="card">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h6 className="card-title mb-0">Todos os Registros</h6>
                <select className="form-select form-select-sm w-auto" value={filter} onChange={e => setFilter(e.target.value)}>
                  <option value="todos">Todos</option>
                  <option value="pendente">Pendente</option>
                  <option value="parcial">Parcial</option>
                  <option value="atrasados">Vencidos</option>
                  <option value="pago">Pagos</option>
                </select>
              </div>

              {filtered.length === 0 ? (
                <p className="text-muted text-center py-4">Nenhum registro.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm table-hover mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="fs-12">Tipo</th>
                        <th className="fs-12">Descrição</th>
                        <th className="fs-12">Processo</th>
                        <th className="fs-12">Valor</th>
                        <th className="fs-12">Vencimento</th>
                        <th className="fs-12">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(r => (
                        <tr key={r.id} className={isOverdue(r) ? 'table-danger' : ''}>
                          <td className="fs-12">
                            <span className="badge bg-light text-dark border">{TYPE_LABEL[r.record_type] ?? r.record_type}</span>
                          </td>
                          <td className="fs-13">{r.description}</td>
                          <td>
                            <button
                              className="btn btn-link p-0 fs-12 text-start"
                              onClick={() => navigate(`/processes/${r.process.id}`)}
                            >
                              {r.process.case_title}
                            </button>
                          </td>
                          <td className="fs-13 fw-medium">{brl(Number(r.total_value))}</td>
                          <td className="fs-12 text-nowrap">
                            {r.due_date
                              ? <span className={isOverdue(r) ? 'text-danger fw-semibold' : ''}>
                                  {new Date(r.due_date).toLocaleDateString('pt-BR')}
                                </span>
                              : <span className="text-muted">—</span>}
                          </td>
                          <td>
                            <span className={`badge fs-11 ${STATUS_BADGE[r.payment_status] ?? 'bg-secondary-subtle'}`}>
                              {STATUS_LABEL[r.payment_status] ?? r.payment_status}
                            </span>
                            {r.payment_type === 'parcelado' && (
                              <span className="text-muted fs-11 ms-1">{r.installments_paid}/{r.installments_total}x</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
