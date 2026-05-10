import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { portalApi } from '../../services/portalApi'

const AREAS = [
  { value: 'trabalhista', label: 'Trabalhista' },
  { value: 'consumidor', label: 'Direito do Consumidor' },
  { value: 'familia', label: 'Família e Sucessões' },
  { value: 'criminal', label: 'Criminal' },
  { value: 'previdenciario', label: 'Previdenciário' },
  { value: 'civil', label: 'Civil' },
  { value: 'tributario', label: 'Tributário' },
  { value: 'outro', label: 'Outro' },
]

export default function PortalNewCase() {
  const navigate  = useNavigate()
  const [description, setDescription] = useState('')
  const [area, setArea]       = useState('')
  const [urgency, setUrgency] = useState<'normal' | 'urgente'>('normal')
  const [loading, setLoading] = useState(false)
  const [erro, setErro]       = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (description.length < 10) { setErro('Descreva o problema com pelo menos 10 caracteres.'); return }
    setLoading(true)
    setErro('')
    try {
      await portalApi.post('/api/portal/new-case-request', { description, area: area || undefined, urgency })
      setSuccess(true)
    } catch {
      setErro('Erro ao enviar solicitação. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (success) return (
    <div className="text-center py-5">
      <div className="fs-40 mb-3">✅</div>
      <h5 className="fw-bold">Solicitação enviada!</h5>
      <p className="text-muted fs-13">O escritório foi notificado e entrará em contato em breve.</p>
      <button className="btn btn-primary mt-2" onClick={() => navigate('/portal/dashboard')}>Voltar ao início</button>
    </div>
  )

  return (
    <>
      <button className="btn btn-link ps-0 mb-3 fs-13" onClick={() => navigate('/portal/dashboard')}>← Voltar</button>
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <h5 className="fw-bold mb-4">Solicitar novo caso</h5>
          {erro && <div className="alert alert-danger py-2 fs-13">{erro}</div>}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label fs-13">Descreva seu problema <span className="text-danger">*</span></label>
              <textarea
                className="form-control"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva com o máximo de detalhes possível o que aconteceu..."
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label fs-13">Área do direito</label>
              <select className="form-select" value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="">Não sei / Outros</option>
                {AREAS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="form-label fs-13">Urgência</label>
              <div className="d-flex gap-3">
                <div className="form-check">
                  <input className="form-check-input" type="radio" id="urgNormal" checked={urgency === 'normal'} onChange={() => setUrgency('normal')} />
                  <label className="form-check-label fs-13" htmlFor="urgNormal">Normal</label>
                </div>
                <div className="form-check">
                  <input className="form-check-input" type="radio" id="urgUrgente" checked={urgency === 'urgente'} onChange={() => setUrgency('urgente')} />
                  <label className="form-check-label fs-13 text-danger" htmlFor="urgUrgente">Urgente</label>
                </div>
              </div>
            </div>
            <button className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
              Enviar solicitação
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
