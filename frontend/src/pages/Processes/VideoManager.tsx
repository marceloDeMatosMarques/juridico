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

type ProvidersStatus = {
  microsoft: { conectado: boolean }
  google: { conectado: boolean }
}

function uploadFileToCloud(
  uploadUrl: string,
  provider: 'onedrive' | 'googledrive',
  file: File,
  onProgress: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { id?: string }
          if (!data.id) { reject(new Error('ID do arquivo não encontrado na resposta do provedor')); return }
          resolve(data.id)
        } catch {
          reject(new Error('Resposta inválida do provedor de armazenamento'))
        }
      } else {
        reject(new Error(`Upload falhou com status ${xhr.status}. Verifique as permissões da conta.`))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Erro de rede durante o upload. Verifique sua conexão.')))
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelado')))

    xhr.open('PUT', uploadUrl)

    if (provider === 'onedrive') {
      xhr.setRequestHeader('Content-Range', `bytes 0-${file.size - 1}/${file.size}`)
    } else {
      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')
    }

    xhr.send(file)
  })
}

export default function VideoManager() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [tab, setTab] = useState<'links' | 'upload'>('links')
  const [videos, setVideos] = useState<VideoLink[]>([])
  const [pdfs, setPdfs] = useState<VideoAnnex[]>([])
  const [loading, setLoading] = useState(true)
  const [providers, setProviders] = useState<ProvidersStatus | null>(null)
  const [generating, setGenerating] = useState(false)

  // Link form state
  const [form, setForm] = useState({ title: '', url: '', description: '' })
  const [adding, setAdding] = useState(false)
  const [linkErro, setLinkErro] = useState('')

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadProvider, setUploadProvider] = useState<'onedrive' | 'googledrive'>('googledrive')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadErro, setUploadErro] = useState('')

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.get<{ videos: VideoLink[] }>(`/api/processes/${id}/videos`),
      api.get<{ pdfs: VideoAnnex[] }>(`/api/processes/${id}/videos/pdf`),
      api.get<ProvidersStatus>('/api/settings/providers').catch(() => ({ data: null as ProvidersStatus | null })),
    ])
      .then(([v, p, prov]) => {
        setVideos(v.data.videos ?? [])
        setPdfs(p.data.pdfs ?? [])
        if (prov.data) {
          setProviders(prov.data)
          if (!prov.data.google.conectado && prov.data.microsoft.conectado) {
            setUploadProvider('onedrive')
          }
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setLinkErro('')
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
      setLinkErro(msg)
    } finally { setAdding(false) }
  }

  async function handleDelete(videoId: string) {
    if (!confirm('Remover este vídeo?')) return
    await api.delete(`/api/processes/${id}/videos/${videoId}`).catch(() => null)
    setVideos(prev => prev.filter(v => v.id !== videoId))
  }

  async function handleGeneratePdf() {
    setGenerating(true)
    try {
      const { data } = await api.post<{ id: string; downloadUrl: string }>(`/api/processes/${id}/videos/pdf`)
      const { data: pdfList } = await api.get<{ pdfs: VideoAnnex[] }>(`/api/processes/${id}/videos/pdf`)
      setPdfs(pdfList.pdfs ?? [])
      window.open(data.downloadUrl, '_blank')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { erro?: string } } }).response?.data?.erro ?? 'Erro ao gerar PDF.'
      alert(msg)
    } finally { setGenerating(false) }
  }

  async function handleFileUpload(e: FormEvent) {
    e.preventDefault()
    if (!uploadFile || !id) return
    setUploadErro('')
    setUploadProgress(0)
    setUploading(true)
    try {
      let video: VideoLink

      if (uploadProvider === 'googledrive') {
        // Google Drive: upload via backend (evita CORS no XHR direto)
        const formData = new FormData()
        formData.append('file', uploadFile)
        formData.append('title', uploadTitle || uploadFile.name.replace(/\.[^.]+$/, ''))
        formData.append('description', uploadDescription)
        const { data } = await api.post<VideoLink>(
          `/api/processes/${id}/videos/upload-googledrive`,
          formData,
          { onUploadProgress: (e) => { if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100)) } }
        )
        video = data
      } else {
        // OneDrive: upload direto do browser via sessão resumable (suporta CORS)
        const { data: session } = await api.post<{ uploadUrl: string; uploadId: string }>(
          `/api/processes/${id}/videos/upload-session`,
          { fileName: uploadFile.name, fileSize: uploadFile.size, mimeType: uploadFile.type || 'video/mp4', targetProvider: uploadProvider }
        )
        const itemId = await uploadFileToCloud(session.uploadUrl, uploadProvider, uploadFile, setUploadProgress)
        const { data } = await api.post<VideoLink>(`/api/processes/${id}/videos/upload-complete`, {
          itemId, uploadId: session.uploadId, fileName: uploadFile.name, fileSize: uploadFile.size,
          targetProvider: uploadProvider, title: uploadTitle || uploadFile.name.replace(/\.[^.]+$/, ''), description: uploadDescription,
        })
        video = data
      }

      setVideos(prev => [...prev, video])
      setUploadFile(null)
      setUploadTitle('')
      setUploadDescription('')
      setUploadProgress(100)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { erro?: string } } }).response?.data?.erro
        ?? (err instanceof Error ? err.message : 'Erro ao fazer upload.')
      setUploadErro(msg)
    } finally { setUploading(false) }
  }

  const noneConnected = providers !== null && !providers.google.conectado && !providers.microsoft.conectado

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

            {/* Left column */}
            <div className="col-md-7">

              <ul className="nav nav-tabs nav-bordered mb-3">
                <li className="nav-item">
                  <button
                    className={`nav-link${tab === 'links' ? ' active' : ''}`}
                    type="button"
                    onClick={() => setTab('links')}
                  >
                    Links Externos ({videos.length})
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link${tab === 'upload' ? ' active' : ''}`}
                    type="button"
                    onClick={() => setTab('upload')}
                  >
                    Upload para Nuvem
                  </button>
                </li>
              </ul>

              {/* Links tab */}
              {tab === 'links' && (
                <div className="card mb-3">
                  <div className="card-body">
                    {videos.length === 0 ? (
                      <p className="text-muted fs-13">Nenhum vídeo cadastrado.</p>
                    ) : (
                      <ul className="list-group list-group-flush mb-3">
                        {videos.map(v => (
                          <li key={v.id} className="list-group-item px-0 py-2">
                            <div className="d-flex align-items-start gap-2">
                              <iconify-icon icon="solar:video-library-bold-duotone" className="text-primary fs-20 flex-shrink-0 mt-1" />
                              <div className="flex-grow-1 overflow-hidden">
                                <div className="fw-medium fs-13">{v.file_name}</div>
                                <a
                                  href={v.file_url ?? '#'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-muted fs-12 text-truncate d-block"
                                >
                                  {v.file_url}
                                </a>
                                {v.notes && <div className="text-muted fs-12 mt-1">{v.notes}</div>}
                              </div>
                              <button
                                className="btn btn-xs btn-outline-danger flex-shrink-0"
                                onClick={() => void handleDelete(v.id)}
                                title="Remover"
                              >✕</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    <hr />
                    <h6 className="mb-3">Adicionar Link Externo</h6>
                    {linkErro && <div className="alert alert-danger py-2 fs-13">{linkErro}</div>}
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
                        {adding ? 'Adicionando...' : '+ Adicionar Link'}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Upload tab */}
              {tab === 'upload' && (
                <div className="card mb-3">
                  <div className="card-body">
                    {noneConnected ? (
                      <div className="alert alert-warning mb-0">
                        <iconify-icon icon="solar:cloud-cross-bold-duotone" className="me-2" />
                        Nenhum provedor conectado. Por favor,{' '}
                        <a href="/configuracoes/provedores">conecte o Google Drive ou OneDrive</a>{' '}
                        para realizar uploads.
                      </div>
                    ) : (
                      <form onSubmit={e => void handleFileUpload(e)}>

                        {/* Provider selector */}
                        <div className="mb-3">
                          <label className="form-label fw-medium fs-13">Provedor de armazenamento</label>
                          <div className="d-flex gap-3">
                            {providers?.google.conectado && (
                              <div className="form-check">
                                <input
                                  className="form-check-input"
                                  type="radio"
                                  name="uploadProvider"
                                  id="provGoogle"
                                  checked={uploadProvider === 'googledrive'}
                                  onChange={() => setUploadProvider('googledrive')}
                                />
                                <label className="form-check-label d-flex align-items-center gap-1 fs-13" htmlFor="provGoogle">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 48 48">
                                    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                                    <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                                    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                                    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                                  </svg>
                                  Google Drive
                                </label>
                              </div>
                            )}
                            {providers?.microsoft.conectado && (
                              <div className="form-check">
                                <input
                                  className="form-check-input"
                                  type="radio"
                                  name="uploadProvider"
                                  id="provOneDrive"
                                  checked={uploadProvider === 'onedrive'}
                                  onChange={() => setUploadProvider('onedrive')}
                                />
                                <label className="form-check-label d-flex align-items-center gap-1 fs-13" htmlFor="provOneDrive">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 23 23">
                                    <path fill="#f3f3f3" d="M0 0h23v23H0z"/>
                                    <path fill="#f35325" d="M1 1h10v10H1z"/>
                                    <path fill="#81bc06" d="M12 1h10v10H12z"/>
                                    <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                                    <path fill="#ffba08" d="M12 12h10v10H12z"/>
                                  </svg>
                                  OneDrive
                                </label>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* File picker */}
                        <div className="mb-3">
                          <label className="form-label fw-medium fs-13">Arquivo de vídeo *</label>
                          <input
                            className="form-control form-control-sm"
                            type="file"
                            accept="video/*"
                            required
                            onChange={e => {
                              const f = e.target.files?.[0] ?? null
                              setUploadFile(f)
                              if (f && !uploadTitle) setUploadTitle(f.name.replace(/\.[^.]+$/, ''))
                            }}
                          />
                          {uploadFile && (
                            <div className="text-muted fs-12 mt-1">
                              {uploadFile.name} · {(uploadFile.size / 1024 / 1024).toFixed(1)} MB
                            </div>
                          )}
                        </div>

                        {/* Title */}
                        <div className="mb-3">
                          <label className="form-label fw-medium fs-13">Título *</label>
                          <input
                            className="form-control form-control-sm"
                            placeholder="Título do vídeo"
                            value={uploadTitle}
                            onChange={e => setUploadTitle(e.target.value)}
                            required
                          />
                        </div>

                        {/* Description */}
                        <div className="mb-3">
                          <label className="form-label fw-medium fs-13">Descrição</label>
                          <input
                            className="form-control form-control-sm"
                            placeholder="Descrição opcional"
                            value={uploadDescription}
                            onChange={e => setUploadDescription(e.target.value)}
                          />
                        </div>

                        {uploadErro && <div className="alert alert-danger py-2 fs-13">{uploadErro}</div>}

                        {/* Progress bar */}
                        {uploading && (
                          <div className="mb-3">
                            <div className="d-flex justify-content-between fs-12 mb-1">
                              <span>Enviando para {uploadProvider === 'googledrive' ? 'Google Drive' : 'OneDrive'}...</span>
                              <span>{uploadProgress}%</span>
                            </div>
                            <div className="progress" style={{ height: 6 }}>
                              <div
                                className="progress-bar progress-bar-striped progress-bar-animated"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        <button
                          className="btn btn-sm btn-primary"
                          type="submit"
                          disabled={uploading || !uploadFile}
                        >
                          {uploading
                            ? 'Enviando...'
                            : `Enviar para ${uploadProvider === 'googledrive' ? 'Google Drive' : 'OneDrive'}`}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right column — PDF generation */}
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
