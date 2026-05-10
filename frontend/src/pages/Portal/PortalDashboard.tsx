import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { portalApi } from '../../services/portalApi'

type Process = {
  id: string
  case_title: string
  process_number?: string
  status: string
  process_type: string
  pending_deadline?: string
  summary_pdf_url?: string
}

const STATUS_LABEL: Record<string, string> = {
  aberto: 'Aberto', em_andamento: 'Em andamento', aguardando_audiencia: 'Aguardando',
  encerrado: 'Encerrado', ganho: 'Ganho', perdido: 'Perdido', acordo: 'Acordo', arquivado: 'Arquivado',
}
const STATUS_COLOR: Record<string, string> = {
  aberto: 'bg-primary-subtle text-primary', em_andamento: 'bg-info-subtle text-info',
  aguardando_audiencia: 'bg-warning-subtle text-warning', encerrado: 'bg-secondary-subtle text-secondary',
  ganho: 'bg-success-subtle text-success', perdido: 'bg-danger-subtle text-danger',
  acordo: 'bg-success-subtle text-success', arquivado: 'bg-secondary-subtle text-secondary',
}

export default function PortalDashboard() {
  const navigate = useNavigate()
  const [processes, setProcesses] = useState<Process[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    portalApi.get<{ processes: Process[] }>('/api/portal/processes')
      .then(({ data }) => setProcesses(data.processes))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>

  const active  = processes.filter(p => ['aberto', 'em_andamento', 'aguardando_audiencia'].includes(p.status))
  const closed  = processes.filter(p => !['aberto', 'em_andamento', 'aguardando_audiencia'].includes(p.status))

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="fw-bold mb-0">Meus Processos</h5>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/portal/novo-caso')}>
          + Solicitar novo caso
        </button>
      </div>

      {processes.length === 0 && (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5 text-muted fs-13">
            Nenhum processo cadastrado ainda.
          </div>
        </div>
      )}

      {active.length > 0 && (
        <>
          <h6 className="text-muted fs-12 text-uppercase mb-2">Ativos ({active.length})</h6>
          <div className="d-flex flex-column gap-2 mb-4">
            {active.map(p => <ProcessCard key={p.id} p={p} onClick={() => navigate(`/portal/processos/${p.id}`)} />)}
          </div>
        </>
      )}

      {closed.length > 0 && (
        <>
          <h6 className="text-muted fs-12 text-uppercase mb-2">Encerrados ({closed.length})</h6>
          <div className="d-flex flex-column gap-2">
            {closed.map(p => <ProcessCard key={p.id} p={p} onClick={() => navigate(`/portal/processos/${p.id}`)} />)}
          </div>
        </>
      )}
    </>
  )
}

function ProcessCard({ p, onClick }: { p: Process; onClick: () => void }) {
  const overdue = p.pending_deadline && new Date(p.pending_deadline) < new Date()
  return (
    <div className="card border-0 shadow-sm cursor-pointer" onClick={onClick}>
      <div className="card-body d-flex align-items-center gap-3 py-3">
        <div className="flex-grow-1 overflow-hidden">
          <div className="fw-medium text-truncate">{p.case_title}</div>
          {p.process_number && <div className="fs-11 text-muted">{p.process_number}</div>}
          {overdue && (
            <div className="fs-11 text-danger mt-1">
              ⚠️ Prazo: {new Date(p.pending_deadline!).toLocaleDateString('pt-BR')}
            </div>
          )}
        </div>
        <span className={`badge fs-10 flex-shrink-0 ${STATUS_COLOR[p.status] ?? 'bg-secondary-subtle'}`}>
          {STATUS_LABEL[p.status] ?? p.status}
        </span>
        <span className="text-muted fs-16">›</span>
      </div>
    </div>
  )
}
