import { useState, useEffect, FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../../services/api'

type VideoLink = {
  id: string
  file_name: string
  file_url: string | null
  notes: string | null
  upload_date: string
}

type VideoAnnex = {
  id: string
  title: string
  pdf_url: string | null
  public_share_link: string | null
  google_drive_share_link: string | null
  generated_at: string
}

export default function VideoManager() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [videos, setVideos] = useState<VideoLink[]>([])
  const [pdfs, setPdfs] = useState<VideoAnnex[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [form, setForm] = useState({ title: '', url: '', description: '' })
  const [adding, setAdding] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.get<{ videos: VideoLink[] }>(`/api/processes/${id}/videos`),
      api.get<{ pdfs: VideoAnnex[] }>(`/api/processes/${id}/videos/pdf`),
    ])
      .then(([v, p]) => { setVideos(v.data.videos ?? []); setPdfs(p.data.pdfs ?? []) })
      .finally(() => setLoading(false))
  }, [id])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setAdding(true)
    try {
      const { data } = await api.post<VideoLink>(`/api/processes/${id}/videos`, {
        title: form.title,
        url: form.url,
        description: form.description,
      })
      setVideos(prev => [...prev, data])
      setForm({ title: '', url: '', description: '' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { erro?: string } } }).response?.data?.erro ?? 'Erro ao adicionar vídeo.'
      setErro(msg)
    } finally { setAdding(false) }
  }

  async function handleDelete(videoId: string) {
    if (!confirm('Remover este link de vídeo?')) return
    await api.delete(`/api/processes/${id}/videos/${videoId}`).catch(() => null)
    setVideos(prev => prev.filter(v => v.id !== videoId))
  }

  async function handleGeneratePdf() {
    setGenerating(true)
    try {
      const { data } = await api.post<{ id: string; downloadUrl: string }>(`/api/processes/${id}/videos/pdf`)
      // Refresh PDFs list
      const { data: pdfList } = await api.get<{ pdfs: VideoAnnex[] }>(`/api/processes/${id}/videos/pdf`)
      setPdfs(pdfList.pdfs ?? [])
      // Auto-open
      window.open(data.downloadUrl, '_blank')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { erro?: string } } }).response?.data?.erro ?? 'Erro ao gerar PDF.'
      alert(msg)
    } finally { setGenerating(false) }
  }

  if (loading) return (
    <div className="content-page"><div className="content p-4">
      <div className="spinner-border text-primary" />
    </div></div>
  )

  return (
    <div className="content-page">
      <div className="content">
        <div className="container-fluid">

          <div className="row">
            <div className="col-12">
              <div className="page-title-box d-flex align-items-center gap-2">
                <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate(-1)}>‹</button>
                <h4 className="page-title mb-0">Mídias do Processo</h4>
              </div>
            </div>
          </div>

          <div className="row">

            {/* Coluna esquerda — lista de vídeos + formulário */}
            <div className="col-md-7">
              <div className="card mb-3">
                <div className="card-body">
                  <h6 className="card-title">Links de Vídeo ({videos.length})</h6>

                  {videos.length === 0 ? (
                    <p className="text-muted fs-13">Nenhum vídeo cadastrado.</p>
                  ) : (
                    <ul className="list-group list-group-flush mb-3">
                      {videos.map(v => (
                        <li key={v.id} className="list-group-item px-0 py-2">
                          <div className="d-flex align-items-start gap-2">
                            <span style={{ fontSize: 20 }}>🎥</span>
                            <div className="flex-grow-1 overflow-hidden">
                              <div className="fw-medium fs-13">{v.file_name}</div>
                              <a
                                href={v.file_url ?? '#'}
                                target="_blank"
                                rel="noreferrer"
                                className="text-muted fs-12 text-truncate d-block"
                                style={{ maxWidth: '100%' }}
                              >
                                {v.file_url}
                              </a>
                              {v.notes && <div className="text-muted fs-12 mt-1">{v.notes}</div>}
                            </div>
                            <button
                              className="btn btn-xs btn-outline-danger flex-shrink-0"
                              onClick={() => handleDelete(v.id)}
                              title="Remover"
                            >✕</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <hr />
                  <h6 className="mb-3">Adicionar Link de Vídeo</h6>
                  {erro && <div className="alert alert-danger py-2 fs-13">{erro}</div>}
                  <form onSubmit={e => void handleAdd(e)}>
                    <div className="mb-2">
                      <input
                        className="form-control form-control-sm"
                        placeholder="Título *"
                        value={form.title}
                        onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="mb-2">
                      <input
                        className="form-control form-control-sm"
                        placeholder="URL * (https://...)"
                        type="url"
                        value={form.url}
                        onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="mb-2">
                      <input
                        className="form-control form-control-sm"
                        placeholder="Descrição (opcional)"
                        value={form.description}
                        onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                      />
                    </div>
                    <button className="btn btn-sm btn-primary" type="submit" disabled={adding}>
                      {adding ? 'Adicionando...' : '+ Adicionar'}
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {/* Coluna direita — geração de PDF */}
            <div className="col-md-5">
              <div className="card mb-3">
                <div className="card-body">
                  <h6 className="card-title">PDF de Mídias</h6>
                  <p className="text-muted fs-13">
                    Gera um PDF com QR codes para todos os vídeos cadastrados.
                    Ideal para juntar ao processo como prova de existência de mídia digital.
                  </p>
                  <button
                    className="btn btn-success w-100"
                    onClick={() => void handleGeneratePdf()}
                    disabled={generating || videos.length === 0}
                  >
                    {generating ? 'Gerando...' : `⬇ Gerar PDF (${videos.length} vídeo${videos.length !== 1 ? 's' : ''})`}
                  </button>
                </div>
              </div>

              {pdfs.length > 0 && (
                <div className="card">
                  <div className="card-body">
                    <h6 className="card-title">PDFs Gerados</h6>
                    <ul className="list-group list-group-flush">
                      {pdfs.map(p => (
                        <li key={p.id} className="list-group-item px-0 py-2">
                          <div className="fs-13 fw-medium mb-1">{p.title}</div>
                          <div className="text-muted fs-12 mb-2">
                            {new Date(p.generated_at).toLocaleString('pt-BR')}
                          </div>
                          <div className="d-flex gap-2 flex-wrap">
                            {p.pdf_url && (
                              <a href={p.pdf_url} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline-secondary">
                                ⬇ Download
                              </a>
                            )}
                            {p.public_share_link && (
                              <a href={p.public_share_link} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline-info">
                                OneDrive ↗
                              </a>
                            )}
                            {p.google_drive_share_link && (
                              <a href={p.google_drive_share_link} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline-success">
                                Google Drive ↗
                              </a>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
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
