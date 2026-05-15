import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import { generateCourtLink } from '../../utils/processo'
import HearingList from './HearingList'
import CourtNotificationsList from './CourtNotificationsList'
import FinancialList from './FinancialList'

type Client = { id: string; full_name: string; cpf: string | null; email: string | null; phone: string | null }
type TimelineEntry = { id: string; action_type: string; description: string; created_at: string }
type Document = { id: string; file_name: string; document_type: string }
type FullDoc = { id: string; file_name: string; document_type: string; file_url: string | null; upload_date: string; uploaded_by_role: string | null; requires_password: boolean }

const DOC_TIPOS = [
  { value: 'extra',                label: 'Outros' },
  { value: 'procuracao',           label: 'Procuração' },
  { value: 'identidade',           label: 'Identidade (RG)' },
  { value: 'cpf',                  label: 'CPF' },
  { value: 'cnh',                  label: 'CNH' },
  { value: 'comprovante_residencia', label: 'Comp. Residência' },
  { value: 'foto_evidencia',       label: 'Foto / Evidência' },
  { value: 'contrato',             label: 'Contrato' },
  { value: 'nota_fiscal',          label: 'Nota Fiscal' },
]

const DOC_LABEL: Record<string, string> = {
  procuracao: 'Procuração', identidade: 'Identidade', cpf: 'CPF', cnh: 'CNH',
  comprovante_residencia: 'Comp. Residência', nota_fiscal: 'Nota Fiscal',
  contrato: 'Contrato', foto_evidencia: 'Foto/Evidência', extra: 'Outro',
}

type Process = {
  id: string
  case_title: string
  process_number: string | null
  process_type: string
  status: string
  court: string | null
  judge: string | null
  opposing_party: string | null
  court_system: string | null
  state: string | null
  open_date: string
  close_date: string | null
  pending_deadline: string | null
  case_description: string | null
  summary_pdf_url: string | null
  ai_summary: string | null
  onedrive_folder_id: string | null
  onedrive_folder_url: string | null
  google_drive_folder_id: string | null
  google_drive_folder_url: string | null
  client: Client
  timeline: TimelineEntry[]
  documents: Document[]
}

const STATUS_BADGE: Record<string, string> = {
  aberto: 'bg-primary text-white',
  em_andamento: 'bg-info text-white',
  aguardando_audiencia: 'bg-warning text-dark',
  encerrado: 'bg-secondary text-white',
  ganho: 'bg-success text-white',
  perdido: 'bg-danger text-white',
  acordo: 'bg-success text-white',
  arquivado: 'bg-secondary text-white',
}

const STATUS_LABEL: Record<string, string> = {
  aberto: 'Aberto', em_andamento: 'Em andamento', aguardando_audiencia: 'Aguardando audiência',
  encerrado: 'Encerrado', ganho: 'Ganho', perdido: 'Perdido', acordo: 'Acordo', arquivado: 'Arquivado',
}

const TYPE_LABEL: Record<string, string> = {
  civil_consumidor: 'Civil — Consumidor', civil_indenizatorio: 'Civil — Indenizatório',
  civil_obrigacional: 'Civil — Obrigacional', trabalhista: 'Trabalhista',
  criminal: 'Criminal', previdenciario: 'Previdenciário', familia: 'Família',
  tributario: 'Tributário', administrativo: 'Administrativo', outro: 'Outro',
}

const TIMELINE_ICON: Record<string, string> = {
  processo_criado: 'mdi mdi-plus-circle-outline text-primary',
  processo_atualizado: 'mdi mdi-pencil-outline text-info',
  pasta_storage_criada: 'mdi mdi-folder-plus-outline text-success',
  documento_adicionado: 'mdi mdi-file-plus-outline text-secondary',
  processo_pdf_gerado: 'mdi mdi-file-pdf-box text-danger',
  processo_pdf_gerado_processo: 'mdi mdi-file-pdf-box text-danger',
}

export default function ProcessDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [processo, setProcesso] = useState<Process | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingAI, setGeneratingAI] = useState(false)
  const [docs, setDocs] = useState<FullDoc[]>([])
  const [uploading, setUploading] = useState(false)
  const [docType, setDocType] = useState('extra')
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchDocs = useCallback(async () => {
    if (!id) return
    const { data } = await api.get<{ documents: FullDoc[] }>(`/api/processes/${id}/documents`)
    setDocs(data.documents)
  }, [id])

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.get<Process>(`/api/processes/${id}`),
      api.get<{ documents: FullDoc[] }>(`/api/processes/${id}/documents`),
    ]).then(([p, d]) => {
      setProcesso(p.data)
      setDocs(d.data.documents)
    }).finally(() => setLoading(false))
  }, [id])

  async function handleUpload(file: File) {
    if (!id) return
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    form.append('document_type', docType)
    try {
      await api.post(`/api/processes/${id}/documents/upload`, form)
      await fetchDocs()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { erro?: string } } }).response?.data?.erro
      alert(msg ?? 'Erro ao enviar arquivo.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDeleteDoc(docId: string) {
    if (!confirm('Excluir este documento?')) return
    try {
      await api.delete(`/api/processes/${id}/documents/${docId}`)
      setDocs(prev => prev.filter(d => d.id !== docId))
    } catch { alert('Erro ao excluir documento.') }
  }

  const generateAiSummary = useCallback(async () => {
    if (!id) return
    setGeneratingAI(true)
    try {
      const { data } = await api.post<{ ai_summary: string }>(`/api/processes/${id}/ai-summary`)
      setProcesso(prev => prev ? { ...prev, ai_summary: data.ai_summary } : prev)
    } catch { alert('Erro ao gerar resumo com IA. Verifique se a chave GEMINI_API_KEY está configurada.') }
    finally { setGeneratingAI(false) }
  }, [id])

  if (loading) return <div className="content-page"><div className="content p-4"><div className="spinner-border text-primary" /></div></div>
  if (!processo) return <div className="content-page"><div className="content p-4"><div className="alert alert-danger">Processo não encontrado.</div></div></div>

  const courtLink = generateCourtLink(processo)

  function copyProcessNumber() {
    if (processo?.process_number) {
      navigator.clipboard.writeText(processo.process_number)
        .then(() => alert('Número copiado!'))
        .catch(() => null)
    }
  }

  return (
    <div className="content-page">
      <div className="content">
        <div className="container-fluid">

          {/* Header */}
          <div className="row">
            <div className="col-12">
              <div className="page-title-box d-flex align-items-center gap-2 flex-wrap">
                <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate(`/clients/${processo.client.id}`)}>‹</button>
                <h4 className="page-title mb-0 me-2">{processo.case_title}</h4>
                <span className={`badge ${STATUS_BADGE[processo.status] ?? 'bg-secondary text-white'}`}>
                  {STATUS_LABEL[processo.status] ?? processo.status}
                </span>
                {processo.summary_pdf_url && (
                  <span className="badge bg-warning text-dark">PDF protocolado</span>
                )}
                {processo.onedrive_folder_id && (
                  <span className="badge bg-info-subtle text-info">OneDrive ✓</span>
                )}
                {processo.google_drive_folder_id && (
                  <span className="badge bg-success-subtle text-success">Google Drive ✓</span>
                )}
              </div>
            </div>
          </div>

          <div className="row">

            {/* Dados do processo */}
            <div className="col-md-4">
              <div className="card mb-3">
                <div className="card-body">
                  <h6 className="card-title">Informações</h6>
                  <ul className="list-unstyled mb-0 fs-14">
                    <li><strong>Cliente:</strong>{' '}
                      <button className="btn btn-link p-0 fs-14" onClick={() => navigate(`/clients/${processo.client.id}`)}>
                        {processo.client.full_name}
                      </button>
                    </li>
                    <li><strong>Tipo:</strong> {TYPE_LABEL[processo.process_type] ?? processo.process_type}</li>
                    {processo.process_number && (
                      <li className="d-flex align-items-center gap-1 flex-wrap">
                        <strong>Nº:</strong>
                        <span className="font-monospace fs-13">{processo.process_number}</span>
                        <button className="btn btn-xs btn-outline-secondary" onClick={copyProcessNumber} title="Copiar">
                          <iconify-icon icon="solar:clipboard-text-linear" />
                        </button>
                        {courtLink && (
                          <a href={courtLink} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline-info" title="Abrir no tribunal">
                            🔗
                          </a>
                        )}
                      </li>
                    )}
                    {processo.court && <li><strong>Vara:</strong> {processo.court}</li>}
                    {processo.judge && <li><strong>Juiz(a):</strong> {processo.judge}</li>}
                    {processo.opposing_party && <li><strong>Parte contrária:</strong> {processo.opposing_party}</li>}
                    {processo.court_system && <li><strong>Sistema:</strong> {processo.court_system.toUpperCase()}</li>}
                    {processo.pending_deadline && (
                      <li><strong>Prazo:</strong>{' '}
                        <span className={new Date(processo.pending_deadline) < new Date() ? 'text-danger fw-bold' : ''}>
                          {new Date(processo.pending_deadline).toLocaleDateString('pt-BR')}
                        </span>
                      </li>
                    )}
                    <li><strong>Abertura:</strong> {new Date(processo.open_date).toLocaleDateString('pt-BR')}</li>
                  </ul>

                  {processo.case_description && (
                    <div className="mt-3 p-2 bg-light rounded fs-13">{processo.case_description}</div>
                  )}

                  {/* AI Summary */}
                  {processo.ai_summary ? (
                    <div className="mt-3 p-2 rounded fs-13" style={{ background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.2)' }}>
                      <div className="d-flex align-items-center gap-1 mb-1">
                        <span className="badge fs-10" style={{ background: 'rgba(99,102,241,.15)', color: '#6366f1' }}>✦ IA</span>
                        <span className="text-muted fs-12">Resumo gerado por IA</span>
                      </div>
                      <div style={{ whiteSpace: 'pre-line' }}>{processo.ai_summary}</div>
                    </div>
                  ) : null}

                  <div className="d-flex flex-wrap gap-2 mt-3">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate(`/processes/${id}/edit`)}>
                      Editar
                    </button>
                    <button className="btn btn-sm btn-outline-primary" onClick={() => navigate(`/processes/${id}/petition`)}>
                      Montador de Petição
                    </button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate(`/processes/${id}/videos`)}>
                      Vídeos
                    </button>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => void generateAiSummary()}
                      disabled={generatingAI}
                      title="Gerar resumo narrativo com Gemini AI"
                    >
                      {generatingAI ? '⏳ Gerando...' : '✦ Resumo IA'}
                    </button>
                    {!processo.process_number && (
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate(`/clients/${processo.client.id}/intake?process=${id}`)}>
                        Intake
                      </button>
                    )}
                  </div>

                  {/* Storage links */}
                  {(processo.onedrive_folder_url || processo.google_drive_folder_url) && (
                    <div className="mt-3 d-flex gap-2 flex-wrap">
                      {processo.onedrive_folder_url && (
                        <a href={processo.onedrive_folder_url} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline-info">
                          OneDrive ↗
                        </a>
                      )}
                      {processo.google_drive_folder_url && (
                        <a href={processo.google_drive_folder_url} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline-success">
                          Google Drive ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Documents */}
              <div className="card mb-3">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="card-title mb-0">Documentos ({docs.length})</h6>
                    <button className="btn btn-xs btn-outline-secondary" onClick={() => navigate(`/processes/${id}/petition`)} title="Montador de Petição (arrastar, girar, gerar PDF)">
                      Montador ↗
                    </button>
                  </div>

                  {/* Upload */}
                  <div className="d-flex gap-2 mb-3">
                    <select className="form-select form-select-sm" value={docType} onChange={e => setDocType(e.target.value)} style={{ maxWidth: 160 }}>
                      {DOC_TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <button className="btn btn-sm btn-outline-primary flex-shrink-0" onClick={() => fileRef.current?.click()} disabled={uploading}>
                      {uploading ? <span className="spinner-border spinner-border-sm me-1" /> : <iconify-icon icon="solar:upload-linear" className="me-1" />}
                      Enviar
                    </button>
                    <input ref={fileRef} type="file" className="d-none"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={e => { const f = e.target.files?.[0]; if (f) void handleUpload(f) }}
                    />
                  </div>

                  {docs.length === 0 ? (
                    <p className="text-muted fs-13 mb-0">Nenhum documento.</p>
                  ) : (
                    <div className="d-flex flex-column gap-1">
                      {docs.map(d => (
                        <div key={d.id} className="d-flex align-items-center gap-2 py-1 border-bottom">
                          <iconify-icon icon="solar:document-linear" className="text-muted fs-16 flex-shrink-0" />
                          <div className="flex-grow-1 overflow-hidden">
                            <div className="fs-13 text-truncate">{d.file_name}</div>
                            <div className="fs-11 text-muted">
                              <span className="badge bg-secondary-subtle text-secondary">{DOC_LABEL[d.document_type] ?? d.document_type}</span>
                              {' '}{new Date(d.upload_date).toLocaleDateString('pt-BR')}
                              {d.uploaded_by_role === 'cliente' && <span className="ms-1 badge bg-info-subtle text-info">cliente</span>}
                              {d.requires_password && <span className="ms-1 badge bg-warning-subtle text-warning">🔒</span>}
                            </div>
                          </div>
                          {d.file_url && (
                            <a href={d.file_url} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline-secondary" title="Baixar">
                              <iconify-icon icon="solar:download-linear" />
                            </a>
                          )}
                          <button className="btn btn-xs btn-outline-danger" title="Excluir" onClick={() => void handleDeleteDoc(d.id)}>
                            <iconify-icon icon="solar:trash-bin-linear" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="col-md-8">
              <div className="card">
                <div className="card-body">
                  <h6 className="card-title">Linha do Tempo</h6>
                  {processo.timeline.length === 0 ? (
                    <p className="text-muted text-center py-3">Nenhuma atividade registrada.</p>
                  ) : (
                    <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                      {processo.timeline.map(entry => (
                        <div key={entry.id} className="d-flex gap-3 mb-3">
                          <div className="flex-shrink-0">
                            <i className={`${TIMELINE_ICON[entry.action_type] ?? 'mdi mdi-circle-outline text-muted'} fs-18`} />
                          </div>
                          <div className="flex-grow-1">
                            <div className="fs-13">{entry.description}</div>
                            <div className="text-muted fs-12">
                              {new Date(entry.created_at).toLocaleString('pt-BR')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

          <div className="row mt-3">
            <div className="col-12">
              <HearingList processId={id!} />
            </div>
          </div>

          <div className="row mt-3">
            <div className="col-12">
              <FinancialList processId={id!} />
            </div>
          </div>

          <div className="row mt-3">
            <div className="col-12">
              <CourtNotificationsList processId={id!} />
            </div>
          </div>

          </div>
        </div>
      </div>
    </div>
  )
}
