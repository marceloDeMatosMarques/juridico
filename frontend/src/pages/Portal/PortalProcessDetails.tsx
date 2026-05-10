import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { portalApi } from '../../services/portalApi'

type Doc = { id: string; document_type: string; file_name: string; file_url?: string; file_type?: string; upload_date: string; uploaded_by_role?: string }
type Hearing = { id: string; title: string; hearing_date: string; hearing_time: string; hearing_type: string; location?: string }
type Timeline = { id: string; action_type: string; description: string; created_at: string }

type ProcessDetail = {
  id: string; case_title: string; process_number?: string; status: string; process_type: string
  open_date: string; pending_deadline?: string; court?: string; judge?: string
  ai_summary?: string; summary_pdf_url?: string; readonly: boolean
  upcoming_hearings: Hearing[]; timeline: Timeline[]
}

const DOC_LABEL: Record<string, string> = {
  procuracao: 'Procuração', identidade: 'Identidade', cpf: 'CPF', cnh: 'CNH',
  comprovante_residencia: 'Comp. Residência', nota_fiscal: 'Nota Fiscal',
  contrato: 'Contrato', foto_evidencia: 'Foto/Evidência', extra: 'Outro',
}

export default function PortalProcessDetails() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const [proc, setProc]       = useState<ProcessDetail | null>(null)
  const [docs, setDocs]       = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([
      portalApi.get<ProcessDetail>(`/api/portal/processes/${id}`),
      portalApi.get<{ documents: Doc[] }>(`/api/portal/processes/${id}/documents`),
    ]).then(([p, d]) => {
      setProc(p.data)
      setDocs(d.data.documents)
    }).catch(() => null).finally(() => setLoading(false))
  }, [id])

  async function handleUpload(file: File) {
    if (!id) return
    setUploading(true)
    setUploadErr('')
    const form = new FormData()
    form.append('file', file)
    try {
      const { data } = await portalApi.post<Doc>(`/api/portal/processes/${id}/upload`, form)
      setDocs(prev => [{ ...data, document_type: 'extra', upload_date: new Date().toISOString(), uploaded_by_role: 'cliente' }, ...prev])
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { erro?: string } } }).response?.data?.erro
      setUploadErr(msg ?? 'Erro ao enviar arquivo.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
  if (!proc) return <p className="text-muted">Processo não encontrado.</p>

  return (
    <>
      <button className="btn btn-link ps-0 mb-3 fs-13" onClick={() => navigate('/portal/dashboard')}>
        ← Voltar
      </button>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <h5 className="fw-bold mb-1">{proc.case_title}</h5>
          {proc.process_number && <div className="text-muted fs-13 mb-2">{proc.process_number}</div>}
          <div className="row g-2 fs-13">
            {proc.court && <div className="col-sm-6"><span className="text-muted">Tribunal:</span> {proc.court}</div>}
            {proc.judge && <div className="col-sm-6"><span className="text-muted">Juiz:</span> {proc.judge}</div>}
            <div className="col-sm-6"><span className="text-muted">Abertura:</span> {new Date(proc.open_date).toLocaleDateString('pt-BR')}</div>
            {proc.pending_deadline && (
              <div className="col-sm-6">
                <span className="text-muted">Prazo:</span>{' '}
                <span className={new Date(proc.pending_deadline) < new Date() ? 'text-danger fw-semibold' : ''}>
                  {new Date(proc.pending_deadline).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )}
          </div>
          {proc.readonly && (
            <div className="alert alert-info py-2 fs-12 mt-3 mb-0">
              Seu processo foi protocolado. Para alterações, entre em contato com o escritório.
            </div>
          )}
        </div>
      </div>

      {proc.ai_summary && (
        <div className="card border-0 shadow-sm mb-3" style={{ borderLeft: '3px solid #6366f1' }}>
          <div className="card-body">
            <div className="fs-12 text-muted mb-1">✦ Resumo do processo</div>
            <p className="mb-0 fs-13">{proc.ai_summary}</p>
          </div>
        </div>
      )}

      {proc.upcoming_hearings.length > 0 && (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <h6 className="card-title mb-3">Próximas audiências</h6>
            {proc.upcoming_hearings.map(h => (
              <div key={h.id} className="d-flex align-items-center gap-3 py-2 border-bottom">
                <div className="fs-20">📅</div>
                <div>
                  <div className="fw-medium fs-13">{h.title}</div>
                  <div className="text-muted fs-12">
                    {new Date(h.hearing_date).toLocaleDateString('pt-BR')} às {h.hearing_time}
                    {h.location && ` — ${h.location}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="card-title mb-0">Documentos ({docs.length})</h6>
            {!proc.readonly && (
              <>
                <button className="btn btn-sm btn-outline-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                  + Enviar documento
                </button>
                <input ref={fileRef} type="file" className="d-none" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
              </>
            )}
          </div>
          {uploadErr && <div className="alert alert-danger py-2 fs-12 mb-2">{uploadErr}</div>}
          {docs.length === 0
            ? <p className="text-muted fs-13">Nenhum documento.</p>
            : docs.map(d => (
              <div key={d.id} className="d-flex align-items-center gap-2 py-2 border-bottom">
                <span className="fs-18">📄</span>
                <div className="flex-grow-1 overflow-hidden">
                  <div className="fs-13 text-truncate">{d.file_name}</div>
                  <div className="fs-11 text-muted">
                    {DOC_LABEL[d.document_type] ?? d.document_type} · {new Date(d.upload_date).toLocaleDateString('pt-BR')}
                    {d.uploaded_by_role === 'cliente' && <span className="ms-1 badge bg-info-subtle text-info fs-10">Enviado por mim</span>}
                  </div>
                </div>
                {d.file_url && (
                  <a href={d.file_url} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline-secondary">
                    ↓
                  </a>
                )}
              </div>
            ))
          }
        </div>
      </div>

      {proc.timeline.length > 0 && (
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <h6 className="card-title mb-3">Histórico</h6>
            {proc.timeline.map(t => (
              <div key={t.id} className="d-flex gap-3 mb-2">
                <div className="text-muted fs-11 text-nowrap">{new Date(t.created_at).toLocaleDateString('pt-BR')}</div>
                <div className="fs-13">{t.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
