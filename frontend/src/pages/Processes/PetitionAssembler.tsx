import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api } from '../../services/api'

type Doc = {
  id: string
  file_name: string
  document_type: string
  file_url: string | null
  file_mime: string | null
  rotation: number
  requires_password: boolean
  order_index: number
  ai_classified: boolean
  onedrive_share_link: string | null
  google_drive_share_link: string | null
}

type VideoLink = { id: string; title: string; url: string; description: string }

const CATEGORIAS_FIXAS = ['procuracao', 'identidade', 'cnh', 'comprovante_residencia']
const LABEL_TIPO: Record<string, string> = {
  procuracao: 'Procuração', identidade: 'Identidade', cnh: 'CNH',
  comprovante_residencia: 'Comp. Residência', foto_evidencia: 'Foto/Evidência',
  contrato: 'Contrato', nota_fiscal: 'Nota Fiscal', extra: 'Outros',
}

const UPLOAD_TIPOS = [
  { value: 'extra', label: 'Outros' },
  { value: 'procuracao', label: 'Procuração' },
  { value: 'identidade', label: 'Identidade (RG)' },
  { value: 'cnh', label: 'CNH' },
  { value: 'comprovante_residencia', label: 'Comp. Residência' },
  { value: 'foto_evidencia', label: 'Foto / Evidência' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'nota_fiscal', label: 'Nota Fiscal' },
]

// ── Cloud badges ───────────────────────────────────────────────────────────────

function CloudBadges({ doc }: { doc: Doc }) {
  return (
    <div className="d-flex gap-1">
      {doc.onedrive_share_link
        ? <a href={doc.onedrive_share_link} target="_blank" rel="noreferrer" className="badge bg-info-subtle text-info text-decoration-none" title="OneDrive">OD</a>
        : null}
      {doc.google_drive_share_link
        ? <a href={doc.google_drive_share_link} target="_blank" rel="noreferrer" className="badge bg-success-subtle text-success text-decoration-none" title="Google Drive">GD</a>
        : null}
    </div>
  )
}

// ── Sortable card ──────────────────────────────────────────────────────────────

function DocCard({
  doc,
  onRotate,
  onDelete,
  onPreview,
  onSync,
}: {
  doc: Doc
  onRotate: (id: string, r: number) => void
  onDelete: (id: string) => void
  onPreview: (doc: Doc) => void
  onSync: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: doc.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  function nextRotation(current: number) { return (current + 90) % 360 }

  const isSynced = !!(doc.onedrive_share_link || doc.google_drive_share_link)

  return (
    <div ref={setNodeRef} style={style} className="card mb-2">
      <div className="card-body p-2 d-flex align-items-center gap-2">
        <span {...attributes} {...listeners} style={{ cursor: 'grab', fontSize: 18, color: '#aaa' }}>⠿</span>
        <button
          className="btn p-0 border-0 bg-transparent"
          style={{ fontSize: 22 }}
          title="Pré-visualizar"
          onClick={() => onPreview(doc)}
        >
          <span style={{ transform: `rotate(${doc.rotation}deg)`, transition: 'transform .2s', display: 'inline-block' }}>
            {doc.file_mime === 'application/pdf' || doc.file_url?.endsWith('.pdf') ? '📄' : '🖼️'}
          </span>
        </button>
        <div className="flex-grow-1 overflow-hidden">
          <div className="fw-medium fs-13 text-truncate">{doc.file_name}</div>
          <div className="d-flex align-items-center gap-1">
            <span className="text-muted fs-12">{LABEL_TIPO[doc.document_type] ?? doc.document_type}</span>
            {doc.ai_classified && (
              <span className="badge fs-10" style={{ background: 'rgba(99,102,241,.15)', color: '#6366f1' }} title="Classificado por IA">✦ IA</span>
            )}
          </div>
        </div>
        <CloudBadges doc={doc} />
        {!isSynced && (
          <button className="btn btn-xs btn-outline-secondary" title="Sincronizar com cloud" onClick={() => onSync(doc.id)}>☁</button>
        )}
        <button className="btn btn-xs btn-outline-secondary" title="Rotacionar" onClick={() => onRotate(doc.id, nextRotation(doc.rotation))}>↻</button>
        <button className="btn btn-xs btn-outline-danger" title="Remover" onClick={() => onDelete(doc.id)}>✕</button>
      </div>
    </div>
  )
}

function FixedDocCard({
  doc,
  onDelete,
  onPreview,
  onSync,
}: {
  doc: Doc
  onDelete: (id: string) => void
  onPreview: (doc: Doc) => void
  onSync: (id: string) => void
}) {
  const isSynced = !!(doc.onedrive_share_link || doc.google_drive_share_link)
  return (
    <div className="card mb-2 border-secondary">
      <div className="card-body p-2 d-flex align-items-center gap-2">
        <span style={{ fontSize: 18, color: '#ccc' }}>📌</span>
        <button
          className="btn p-0 border-0 bg-transparent"
          style={{ fontSize: 20 }}
          title="Pré-visualizar"
          onClick={() => onPreview(doc)}
        >
          {doc.file_mime === 'application/pdf' || doc.file_url?.endsWith('.pdf') ? '📄' : '🖼️'}
        </button>
        <div className="flex-grow-1 overflow-hidden">
          <div className="fw-medium fs-13 text-truncate">{doc.file_name}</div>
          <div className="d-flex align-items-center gap-1">
            <span className="text-muted fs-12">{LABEL_TIPO[doc.document_type] ?? doc.document_type}</span>
            {doc.ai_classified && (
              <span className="badge fs-10" style={{ background: 'rgba(99,102,241,.15)', color: '#6366f1' }} title="Classificado por IA">✦ IA</span>
            )}
          </div>
        </div>
        <CloudBadges doc={doc} />
        {!isSynced && (
          <button className="btn btn-xs btn-outline-secondary" title="Sincronizar com cloud" onClick={() => onSync(doc.id)}>☁</button>
        )}
        <button className="btn btn-xs btn-outline-danger" title="Remover" onClick={() => onDelete(doc.id)}>✕</button>
      </div>
    </div>
  )
}

// ── Preview modal ──────────────────────────────────────────────────────────────

function PreviewModal({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const isPdf = doc.file_mime === 'application/pdf' || doc.file_url?.endsWith('.pdf')
  return (
    <div
      className="modal d-block"
      style={{ background: 'rgba(0,0,0,0.75)', position: 'fixed', inset: 0, zIndex: 1050 }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-xl modal-dialog-centered"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '90vh' }}
      >
        <div className="modal-content" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <div className="modal-header py-2">
            <h6 className="modal-title mb-0 text-truncate">{doc.file_name}</h6>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body p-0 flex-grow-1" style={{ overflow: 'hidden', minHeight: 0 }}>
            {isPdf ? (
              <iframe
                src={doc.file_url ?? ''}
                title={doc.file_name}
                style={{ width: '100%', height: '75vh', border: 'none' }}
              />
            ) : (
              <div className="d-flex justify-content-center align-items-center h-100 p-3" style={{ minHeight: 400, background: '#222' }}>
                <img
                  src={doc.file_url ?? ''}
                  alt={doc.file_name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '72vh',
                    objectFit: 'contain',
                    transform: `rotate(${doc.rotation}deg)`,
                    transition: 'transform .3s',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PetitionAssembler() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [htmlContent, setHtmlContent] = useState('')
  const [videoLinks, setVideoLinks] = useState<VideoLink[]>([])
  const [docs, setDocs] = useState<Doc[]>([])
  const [loadingReq, setLoadingReq] = useState(false)
  const [loadingProc, setLoadingProc] = useState(false)
  const [reqUrl, setReqUrl] = useState('')
  const [procUrl, setProcUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadType, setUploadType] = useState('extra')
  const [preview, setPreview] = useState<Doc | null>(null)

  const sensors = useSensors(useSensor(PointerSensor))
  const debouncedRotation = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!id) return
    api.get<{ case_description: string }>(`/api/processes/${id}/petition/preview`)
      .then(({ data }) => {
        if (editorRef.current && data.case_description) {
          editorRef.current.innerHTML = data.case_description
          setHtmlContent(data.case_description)
        }
      })
      .catch(() => null)

    api.get<{ documents: Doc[] }>(`/api/processes/${id}/documents`)
      .then(({ data }) => setDocs(data.documents ?? []))
      .catch(() => null)
  }, [id])

  function refreshDocs() {
    api.get<{ documents: Doc[] }>(`/api/processes/${id}/documents`)
      .then(({ data }) => setDocs(data.documents ?? []))
      .catch(() => null)
  }

  function execFormat(cmd: string) {
    document.execCommand(cmd, false, undefined)
    editorRef.current?.focus()
  }

  function handleEditorInput() {
    setHtmlContent(editorRef.current?.innerHTML ?? '')
  }

  function addVideoLink() {
    setVideoLinks(prev => [...prev, { id: crypto.randomUUID(), title: '', url: '', description: '' }])
  }

  function updateVideoLink(linkId: string, field: keyof VideoLink, value: string) {
    setVideoLinks(prev => prev.map(v => v.id === linkId ? { ...v, [field]: value } : v))
  }

  function removeVideoLink(linkId: string) {
    setVideoLinks(prev => prev.filter(v => v.id !== linkId))
  }

  async function handleUpload(file: File) {
    if (!id) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('document_type', uploadType)
    setUploading(true)
    try {
      await api.post(`/api/processes/${id}/documents/upload`, fd)
      refreshDocs()
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch { alert('Erro ao enviar documento.') }
    finally { setUploading(false) }
  }

  async function handleDelete(docId: string) {
    if (!confirm('Remover este documento?')) return
    await api.delete(`/api/processes/${id}/documents/${docId}`).catch(() => null)
    setDocs(prev => prev.filter(d => d.id !== docId))
  }

  async function handleSync(docId: string) {
    try {
      const { data } = await api.post<{ onedrive_share_link: string | null; google_drive_share_link: string | null }>(
        `/api/processes/${id}/documents/${docId}/sync`
      )
      setDocs(prev => prev.map(d => d.id === docId ? { ...d, ...data } : d))
    } catch { alert('Erro ao sincronizar com cloud.') }
  }

  function handleRotate(docId: string, rotation: number) {
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, rotation } : d))
    if (debouncedRotation.current) clearTimeout(debouncedRotation.current)
    debouncedRotation.current = setTimeout(() => {
      api.put(`/api/processes/${id}/documents/${docId}/rotate`, { rotation }).catch(() => null)
    }, 500)
  }

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setDocs(prev => {
      const variavel = prev.filter(d => !CATEGORIAS_FIXAS.includes(d.document_type))
      const fixos = prev.filter(d => CATEGORIAS_FIXAS.includes(d.document_type))
      const oldIndex = variavel.findIndex(d => d.id === active.id)
      const newIndex = variavel.findIndex(d => d.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      const reordered = arrayMove(variavel, oldIndex, newIndex)
      const updated = reordered.map((d, i) => ({ ...d, order_index: i + 10 }))
      api.put(`/api/processes/${id}/documents/reorder`, { documentIds: updated.map(d => d.id) }).catch(() => null)
      return [...fixos, ...updated]
    })
  }, [id])

  async function gerarRequerimento() {
    if (!id) return
    setLoadingReq(true)
    setReqUrl('')
    try {
      const { data } = await api.post<{ downloadUrl: string }>(`/api/processes/${id}/petition`, {
        type: 'requerimento',
        htmlContent,
        videoLinks: videoLinks.filter(v => v.title && v.url),
      })
      setReqUrl(data.downloadUrl)
    } catch { alert('Erro ao gerar requerimento.') }
    finally { setLoadingReq(false) }
  }

  async function gerarProcesso() {
    if (!id) return
    setLoadingProc(true)
    setProcUrl('')
    try {
      const variaveis = docs.filter(d => !CATEGORIAS_FIXAS.includes(d.document_type))
      const { data } = await api.post<{ downloadUrl: string; pageCount: number }>(`/api/processes/${id}/petition`, {
        type: 'processo',
        documentIds: variaveis.map(d => d.id),
      })
      setProcUrl(data.downloadUrl)
    } catch { alert('Erro ao gerar PDF do processo.') }
    finally { setLoadingProc(false) }
  }

  const fixedDocs = docs
    .filter(d => CATEGORIAS_FIXAS.includes(d.document_type))
    .sort((a, b) => a.order_index - b.order_index)
  const variableDocs = docs
    .filter(d => !CATEGORIAS_FIXAS.includes(d.document_type))
    .sort((a, b) => a.order_index - b.order_index)

  const missingFixed = ['procuracao', 'identidade', 'comprovante_residencia']
    .filter(tipo => !fixedDocs.some(d => d.document_type === tipo || (tipo === 'identidade' && d.document_type === 'cnh')))

  return (
    <div className="content-page">
      <div className="content">
        <div className="container-fluid">

          <div className="row">
            <div className="col-12">
              <div className="page-title-box d-flex align-items-center gap-2">
                <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate(-1)}>‹</button>
                <h4 className="page-title mb-0">Montador de Petição</h4>
              </div>
            </div>
          </div>

          <div className="row">

            {/* Painel esquerdo — Requerimento */}
            <div className="col-lg-6">
              <div className="card">
                <div className="card-body">
                  <h6 className="card-title">Requerimento</h6>

                  <div className="btn-group mb-2 flex-wrap" role="group">
                    {[
                      { cmd: 'bold',               label: <strong>B</strong> },
                      { cmd: 'italic',             label: <em>I</em> },
                      { cmd: 'underline',          label: <u>U</u> },
                      { cmd: 'insertUnorderedList', label: '• lista' },
                      { cmd: 'insertOrderedList',   label: '1. lista' },
                      { cmd: 'justifyLeft',        label: '⇤' },
                      { cmd: 'justifyCenter',      label: '⇔' },
                      { cmd: 'justifyRight',       label: '⇥' },
                    ].map(({ cmd, label }) => (
                      <button
                        key={cmd}
                        type="button"
                        className="btn btn-xs btn-outline-secondary"
                        onMouseDown={e => { e.preventDefault(); execFormat(cmd) }}
                      >{label}</button>
                    ))}
                  </div>

                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleEditorInput}
                    className="form-control"
                    style={{ minHeight: 220, overflowY: 'auto' }}
                  />

                  <div className="mt-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="mb-0 fs-13 fw-semibold">Links de Vídeo</h6>
                      <button className="btn btn-xs btn-outline-primary" onClick={addVideoLink}>+ Adicionar</button>
                    </div>
                    {videoLinks.map(v => (
                      <div key={v.id} className="card card-body p-2 mb-2">
                        <div className="row g-2">
                          <div className="col-12">
                            <input
                              className="form-control form-control-sm"
                              placeholder="Título"
                              value={v.title}
                              onChange={e => updateVideoLink(v.id, 'title', e.target.value)}
                            />
                          </div>
                          <div className="col-12">
                            <input
                              className="form-control form-control-sm"
                              placeholder="URL"
                              value={v.url}
                              onChange={e => updateVideoLink(v.id, 'url', e.target.value)}
                            />
                          </div>
                          <div className="col-12 d-flex gap-2">
                            <input
                              className="form-control form-control-sm"
                              placeholder="Descrição (opcional)"
                              value={v.description}
                              onChange={e => updateVideoLink(v.id, 'description', e.target.value)}
                            />
                            <button className="btn btn-xs btn-outline-danger" onClick={() => removeVideoLink(v.id)}>✕</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    className="btn btn-primary mt-3 w-100"
                    onClick={() => void gerarRequerimento()}
                    disabled={loadingReq}
                  >
                    {loadingReq ? 'Gerando...' : '⬇ Baixar requerimento.pdf'}
                  </button>
                  {reqUrl && (
                    <a href={reqUrl} target="_blank" rel="noreferrer" className="btn btn-outline-success w-100 mt-2">
                      ✓ Abrir requerimento.pdf
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Painel direito — Documentação */}
            <div className="col-lg-6">
              <div className="card">
                <div className="card-body">
                  <h6 className="card-title">Documentação do Processo</h6>

                  {missingFixed.length > 0 && (
                    <div className="alert alert-warning py-2 fs-13 mb-3">
                      <strong>Documentos pendentes:</strong>
                      <ul className="mb-0 mt-1">
                        {missingFixed.includes('procuracao') && <li>Procuração não encontrada</li>}
                        {missingFixed.includes('identidade') && <li>RG ou CNH não encontrado</li>}
                        {missingFixed.includes('comprovante_residencia') && <li>Comprovante de residência não encontrado</li>}
                      </ul>
                    </div>
                  )}

                  {fixedDocs.length > 0 && (
                    <div className="mb-2">
                      <p className="text-muted fs-12 mb-1">Posição fixa:</p>
                      {fixedDocs.map(d => (
                        <FixedDocCard
                          key={d.id}
                          doc={d}
                          onDelete={handleDelete}
                          onPreview={setPreview}
                          onSync={handleSync}
                        />
                      ))}
                    </div>
                  )}

                  {variableDocs.length > 0 && (
                    <div className="mb-2">
                      <p className="text-muted fs-12 mb-1">Documentos do caso (arraste para reordenar):</p>
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={variableDocs.map(d => d.id)} strategy={verticalListSortingStrategy}>
                          {variableDocs.map(d => (
                            <DocCard
                              key={d.id}
                              doc={d}
                              onRotate={handleRotate}
                              onDelete={handleDelete}
                              onPreview={setPreview}
                              onSync={handleSync}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    </div>
                  )}

                  {docs.length === 0 && (
                    <p className="text-muted text-center py-3 fs-13">Nenhum documento cadastrado.</p>
                  )}

                  {/* Upload */}
                  <div className="mt-3 pt-3 border-top">
                    <div className="d-flex gap-2 align-items-center flex-wrap">
                      <select
                        className="form-select form-select-sm"
                        style={{ maxWidth: 180 }}
                        value={uploadType}
                        onChange={e => setUploadType(e.target.value)}
                      >
                        {UPLOAD_TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <button
                        className="btn btn-sm btn-outline-primary"
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {uploading ? 'Enviando...' : '+ Adicionar documento'}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
                        style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) void handleUpload(f) }}
                      />
                    </div>
                  </div>

                  <button
                    className="btn btn-success w-100 mt-3"
                    onClick={() => void gerarProcesso()}
                    disabled={loadingProc || docs.length === 0}
                  >
                    {loadingProc ? 'Gerando...' : '⬇ Baixar processo.pdf'}
                  </button>
                  {procUrl && (
                    <a href={procUrl} target="_blank" rel="noreferrer" className="btn btn-outline-success w-100 mt-2">
                      ✓ Abrir processo.pdf
                    </a>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Preview modal */}
      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
