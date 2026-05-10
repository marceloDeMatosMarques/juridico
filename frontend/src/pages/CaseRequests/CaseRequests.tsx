import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../services/api'

type Client = { id: string; full_name: string; email?: string; phone?: string }
type CaseRequest = {
  id: string
  client: Client
  description: string
  area?: string
  urgency: string
  status: string
  created_at: string
}

const AREA_LABEL: Record<string, string> = {
  trabalhista: 'Trabalhista', consumidor: 'Consumidor', familia: 'Família',
  criminal: 'Criminal', previdenciario: 'Previdenciário', civil: 'Civil',
  tributario: 'Tributário', outro: 'Outro',
}

export default function CaseRequests() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState<CaseRequest[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    api.get<{ requests: CaseRequest[] }>('/api/case-requests')
      .then(({ data }) => setRequests(data.requests))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  async function convert(id: string) {
    const { data } = await api.post<{ process_id: string }>(`/api/case-requests/${id}/convert`).catch(() => ({ data: null }))
    if (data?.process_id) {
      setRequests(prev => prev.filter(r => r.id !== id))
      navigate(`/processes/${data.process_id}`)
    }
  }

  async function reject(id: string) {
    await api.post(`/api/case-requests/${id}/reject`).catch(() => null)
    setRequests(prev => prev.filter(r => r.id !== id))
  }

  if (loading) return <div className="content-page"><div className="content d-flex justify-content-center align-items-center" style={{ minHeight: 200 }}><div className="spinner-border text-primary" /></div></div>

  return (
    <div className="content-page">
      <div className="content">
        <div className="container-fluid">
          <div className="row mb-3">
            <div className="col-12 d-flex justify-content-between align-items-center">
              <h4 className="page-title mb-0">Solicitações de Novo Caso</h4>
            </div>
          </div>

          {requests.length === 0 ? (
            <div className="card border-0 shadow-sm">
              <div className="card-body text-center py-5 text-muted fs-13">
                Nenhuma solicitação pendente.
              </div>
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {requests.map(r => (
                <div key={r.id} className={`card border-0 shadow-sm ${r.urgency === 'urgente' ? 'border-start border-danger border-3' : ''}`}>
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <span className="fw-medium">{r.client.full_name}</span>
                        {r.client.phone && <span className="text-muted fs-12 ms-2">{r.client.phone}</span>}
                      </div>
                      <div className="d-flex gap-2 align-items-center">
                        {r.urgency === 'urgente' && <span className="badge bg-danger fs-10">URGENTE</span>}
                        {r.area && <span className="badge bg-secondary-subtle text-secondary fs-10">{AREA_LABEL[r.area] ?? r.area}</span>}
                        <span className="text-muted fs-11">{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                    <p className="fs-13 text-muted mb-3" style={{ whiteSpace: 'pre-wrap' }}>{r.description}</p>
                    <div className="d-flex gap-2">
                      <button className="btn btn-sm btn-primary" onClick={() => convert(r.id)}>
                        ✓ Converter em processo
                      </button>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate(`/clients/${r.client.id}`)}>
                        Ver cliente
                      </button>
                      <button className="btn btn-sm btn-outline-danger ms-auto" onClick={() => reject(r.id)}>
                        Recusar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
