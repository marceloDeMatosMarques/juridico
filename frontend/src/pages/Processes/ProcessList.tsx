import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import { useDebounce } from '../../hooks/useDebounce'

type Process = {
  id: string
  case_title: string
  process_number: string | null
  status: string
  process_type: string
  open_date: string
  client: { id: string; full_name: string }
  onedrive_folder_url: string | null
  google_drive_folder_url: string | null
}

const STATUS_BADGE: Record<string, string> = {
  aberto: 'bg-primary-subtle text-primary',
  em_andamento: 'bg-info-subtle text-info',
  aguardando_audiencia: 'bg-warning-subtle text-warning',
  encerrado: 'bg-secondary-subtle text-secondary',
  ganho: 'bg-success-subtle text-success',
  perdido: 'bg-danger-subtle text-danger',
  acordo: 'bg-success-subtle text-success',
  arquivado: 'bg-secondary-subtle text-secondary',
}

const STATUS_LABEL: Record<string, string> = {
  aberto: 'Aberto', em_andamento: 'Em andamento', aguardando_audiencia: 'Aguard. audiência',
  encerrado: 'Encerrado', ganho: 'Ganho', perdido: 'Perdido', acordo: 'Acordo', arquivado: 'Arquivado',
}

export default function ProcessList() {
  const navigate = useNavigate()
  const [processes, setProcesses] = useState<Process[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const debouncedQ = useDebounce(q, 300)
  const LIMIT = 20

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
    if (debouncedQ) params.set('q', debouncedQ)
    if (status) params.set('status', status)
    api.get<{ processes: Process[]; total: number }>(`/api/processes?${params}`)
      .then(({ data }) => { setProcesses(data.processes); setTotal(data.total) })
      .finally(() => setLoading(false))
  }, [page, debouncedQ, status])

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="content-page">
      <div className="content">
        <div className="container-fluid">

          <div className="row">
            <div className="col-12">
              <div className="page-title-box d-flex align-items-center justify-content-between">
                <h4 className="page-title mb-0">Processos</h4>
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/processes/new')}>
                  + Novo Processo
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="row mb-3 g-2">
                <div className="col-md-6">
                  <input
                    className="form-control"
                    placeholder="Buscar por título, número ou cliente..."
                    value={q}
                    onChange={e => { setQ(e.target.value); setPage(1) }}
                  />
                </div>
                <div className="col-md-3">
                  <select className="form-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
                    <option value="">Todos os status</option>
                    <option value="aberto">Aberto</option>
                    <option value="em_andamento">Em andamento</option>
                    <option value="aguardando_audiencia">Aguardando audiência</option>
                    <option value="encerrado">Encerrado</option>
                    <option value="ganho">Ganho</option>
                    <option value="perdido">Perdido</option>
                    <option value="acordo">Acordo</option>
                    <option value="arquivado">Arquivado</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-4"><div className="spinner-border text-primary" /></div>
              ) : processes.length === 0 ? (
                <p className="text-muted text-center py-4">Nenhum processo encontrado.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover table-sm align-middle">
                    <thead>
                      <tr>
                        <th>Título</th>
                        <th>Nº Processo</th>
                        <th>Cliente</th>
                        <th>Status</th>
                        <th>Abertura</th>
                        <th>Storage</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processes.map(p => (
                        <tr key={p.id}>
                          <td className="fw-medium">{p.case_title}</td>
                          <td className="text-muted fs-13">{p.process_number ?? '—'}</td>
                          <td>
                            <button
                              className="btn btn-link p-0 text-decoration-none fs-13"
                              onClick={() => navigate(`/clients/${p.client.id}`)}
                            >
                              {p.client.full_name}
                            </button>
                          </td>
                          <td>
                            <span className={`badge ${STATUS_BADGE[p.status] ?? 'bg-secondary-subtle text-secondary'}`}>
                              {STATUS_LABEL[p.status] ?? p.status}
                            </span>
                          </td>
                          <td className="text-muted fs-13">{new Date(p.open_date).toLocaleDateString('pt-BR')}</td>
                          <td>
                            <div className="d-flex gap-1">
                              {p.onedrive_folder_url && (
                                <a href={p.onedrive_folder_url} target="_blank" rel="noreferrer" title="OneDrive">
                                  <img src="/assets/images/brands/onedrive.png" style={{ height: 16 }} alt="OneDrive"
                                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                                  <span className="badge bg-info-subtle text-info ms-1 fs-11">OD</span>
                                </a>
                              )}
                              {p.google_drive_folder_url && (
                                <a href={p.google_drive_folder_url} target="_blank" rel="noreferrer" title="Google Drive">
                                  <span className="badge bg-success-subtle text-success fs-11">GD</span>
                                </a>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="d-flex gap-1">
                              <button className="btn btn-xs btn-outline-secondary" onClick={() => navigate(`/processes/${p.id}`)} title="Ver processo">
                                <iconify-icon icon="solar:eye-linear" />
                              </button>
                              <button className="btn btn-xs btn-outline-primary" onClick={() => navigate(`/processes/${p.id}/edit`)} title="Editar">
                                <iconify-icon icon="solar:pen-linear" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <span className="text-muted fs-13">{total} processo(s)</span>
                  <div className="d-flex gap-1">
                    <button className="btn btn-xs btn-outline-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
                    <span className="btn btn-xs btn-outline-secondary disabled">{page}/{totalPages}</span>
                    <button className="btn btn-xs btn-outline-secondary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
