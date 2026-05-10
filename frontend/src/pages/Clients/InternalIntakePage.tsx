import { useState, useEffect, FormEvent } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import type { Client } from '../../types/client'

type Process = { id: string; case_title: string; process_number?: string; case_description?: string }
type DocExistente = { id: string; file_name: string; document_type: string }

export default function InternalIntakePage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const initialProcess = searchParams.get('process')

  const [cliente, setCliente] = useState<Client | null>(null)
  const [processos, setProcessos] = useState<Process[]>([])
  const [selectedProcess, setSelectedProcess] = useState(initialProcess ?? '')
  const [resumo, setResumo] = useState('')
  const [docs, setDocs] = useState<DocExistente[]>([])
  const [salvando, setSalvando] = useState(false)
  const [reqPassword, setReqPassword] = useState(false)
  const [arquivoPendente, setArquivoPendente] = useState<File | null>(null)
  const [tipoPendente, setTipoPendente] = useState('')
  const [senhaModal, setSenhaModal] = useState('')

  useEffect(() => {
    if (!id) return
    api.get<Client & { processes: Process[] }>(`/api/clients/${id}`)
      .then(({ data }) => {
        setCliente(data)
        setProcessos(data.processes ?? [])
        if (initialProcess) {
          const p = data.processes?.find(x => x.id === initialProcess)
          if (p?.case_description) setResumo(p.case_description)
        }
      })
  }, [id, initialProcess])

  useEffect(() => {
    if (!selectedProcess) return
    api.get<{ documents: DocExistente[] }>(`/api/processes/${selectedProcess}/documents`)
      .then(({ data }) => setDocs(data.documents ?? []))
      .catch(() => null)
  }, [selectedProcess])

  async function salvarResumo(e: FormEvent) {
    e.preventDefault()
    if (!selectedProcess) return
    setSalvando(true)
    try {
      await api.post(`/api/processes/${selectedProcess}/summary`, { case_description: resumo })
      alert('Resumo salvo com sucesso.')
    } catch { alert('Erro ao salvar resumo.') }
    finally { setSalvando(false) }
  }

  async function handleUpload(file: File, documentType: string, senha?: string) {
    if (!selectedProcess) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('document_type', documentType)
    if (senha) fd.append('password', senha)
    try {
      const { data } = await api.post<{ requiresPassword?: boolean; id?: string }>(
        `/api/processes/${selectedProcess}/documents/upload`, fd
      )
      if (data.requiresPassword) {
        setArquivoPendente(file)
        setTipoPendente(documentType)
        setReqPassword(true)
        return
      }
      setDocs(prev => [...prev, { id: data.id ?? '', file_name: file.name, document_type: documentType }])
    } catch { alert('Erro ao enviar arquivo.') }
  }

  async function confirmarSenha() {
    if (arquivoPendente) {
      await handleUpload(arquivoPendente, tipoPendente, senhaModal)
      setReqPassword(false); setSenhaModal(''); setArquivoPendente(null)
    }
  }

  if (!cliente) return <div className="content-page"><div className="content p-4"><div className="spinner-border text-primary" /></div></div>

  return (
    <div className="content-page">
      <div className="content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <div className="page-title-box d-flex align-items-center gap-2">
                <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate(`/clients/${id}`)}>‹</button>
                <h4 className="page-title mb-0">Intake interno — {cliente.full_name}</h4>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-lg-8">
              <div className="card mb-3">
                <div className="card-body">
                  <div className="mb-3">
                    <label className="form-label fw-medium">Processo</label>
                    <select
                      className="form-select"
                      value={selectedProcess}
                      onChange={e => {
                        setSelectedProcess(e.target.value)
                        const p = processos.find(x => x.id === e.target.value)
                        setResumo(p?.case_description ?? '')
                      }}
                    >
                      <option value="">Selecione um processo</option>
                      {processos.map(p => (
                        <option key={p.id} value={p.id}>{p.case_title}{p.process_number ? ` (${p.process_number})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  {selectedProcess && (
                    <form onSubmit={salvarResumo}>
                      <div className="mb-3">
                        <label className="form-label fw-medium">Resumo do Caso</label>
                        <textarea className="form-control" rows={6} value={resumo} onChange={e => setResumo(e.target.value)} placeholder="Descreva o caso para compor o requerimento..." />
                      </div>
                      <button className="btn btn-primary" type="submit" disabled={salvando}>
                        {salvando ? 'Salvando...' : 'Salvar Resumo'}
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {selectedProcess && (
                <div className="card">
                  <div className="card-body">
                    <h6 className="card-title">Documentos</h6>
                    {[
                      { tipo: 'procuracao', label: 'Procuração' },
                      { tipo: 'identidade', label: 'RG ou CNH' },
                      { tipo: 'comprovante_residencia', label: 'Comprovante de residência' },
                      { tipo: 'extra', label: 'Outros documentos' },
                    ].map(({ tipo, label }) => (
                      <div key={tipo} className="mb-3">
                        <label className="form-label fs-13">{label}</label>
                        <input
                          type="file"
                          className="form-control form-control-sm"
                          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
                          onChange={e => { const f = e.target.files?.[0]; if (f) void handleUpload(f, tipo) }}
                        />
                      </div>
                    ))}
                    {docs.length > 0 && (
                      <ul className="list-group list-group-sm mt-2">
                        {docs.map(d => (
                          <li key={d.id} className="list-group-item py-1 fs-13">
                            ✓ {d.file_name} <span className="text-muted">({d.document_type})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {reqPassword && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="modal-dialog modal-sm">
            <div className="modal-content">
              <div className="modal-header"><h6 className="modal-title">PDF protegido por senha</h6></div>
              <div className="modal-body">
                <input className="form-control" type="password" value={senhaModal} onChange={e => setSenhaModal(e.target.value)} placeholder="Senha do PDF" />
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary btn-sm" onClick={() => { setReqPassword(false); setSenhaModal('') }}>Cancelar</button>
                <button className="btn btn-primary btn-sm" onClick={() => void confirmarSenha()}>Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
