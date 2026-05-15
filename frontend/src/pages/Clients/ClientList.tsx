import { useState, useEffect, useCallback, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import { useDebounce } from '../../hooks/useDebounce'
import { mascararCPF } from '../../utils/cpf'
import type { Client, ClientListResponse } from '../../types/client'

type IntakeNovoForm = { name: string; whatsapp: string; case_title: string }

export default function ClientList() {
  const navigate = useNavigate()
  const [clientes, setClientes] = useState<Client[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [pages, setPages]       = useState(1)
  const [busca, setBusca]       = useState('')
  const [status, setStatus]     = useState('')
  const [carregando, setCarregando] = useState(false)

  // Modal intake novo cliente
  const [showNovoModal, setShowNovoModal] = useState(false)
  const [novoForm, setNovoForm] = useState<IntakeNovoForm>({ name: '', whatsapp: '', case_title: '' })
  const [novoLoading, setNovoLoading] = useState(false)
  const [novoLink, setNovoLink] = useState<string | null>(null)

  const buscaDebounced = useDebounce(busca, 300)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const { data } = await api.get<ClientListResponse>('/api/clients', {
        params: { page, limit: 20, busca: buscaDebounced, status: status || undefined },
      })
      setClientes(data.data)
      setTotal(data.total)
      setPages(data.pages)
    } catch { /* tratado pelo interceptor */ }
    finally { setCarregando(false) }
  }, [page, buscaDebounced, status])

  useEffect(() => { void carregar() }, [carregar])
  useEffect(() => { setPage(1) }, [buscaDebounced, status])

  async function gerarLinkIntakeCliente(clientId: string) {
    try {
      const { data } = await api.post<{ link: string }>('/api/intake/generate', { client_id: clientId })
      await navigator.clipboard.writeText(data.link)
      alert('Link de intake copiado para a área de transferência!')
    } catch { alert('Erro ao gerar link de intake.') }
  }

  async function handleNovoIntakeSubmit(e: FormEvent) {
    e.preventDefault()
    setNovoLoading(true)
    try {
      const { data } = await api.post<{ link: string }>('/api/intake/generate-new', {
        name:       novoForm.name,
        whatsapp:   novoForm.whatsapp || undefined,
        case_title: novoForm.case_title || undefined,
      })
      setNovoLink(data.link)
    } catch { alert('Erro ao gerar link de intake.') }
    finally { setNovoLoading(false) }
  }

  function fecharNovoModal() {
    setShowNovoModal(false)
    setNovoForm({ name: '', whatsapp: '', case_title: '' })
    setNovoLink(null)
  }

  return (
    <div className="content-page">
      <div className="content">
        <div className="container-fluid">

          <div className="row">
            <div className="col-12">
              <div className="page-title-box">
                <h4 className="page-title">Clientes</h4>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-12">
              <div className="card">
                <div className="card-body">

                  <div className="row mb-3 align-items-center">
                    <div className="col-md-4">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Buscar por nome, CPF ou e-mail..."
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                        <option value="">Todos os status</option>
                        <option value="ativo">Ativo</option>
                        <option value="inativo">Inativo</option>
                      </select>
                    </div>
                    <div className="col-md-5 text-end d-flex gap-2 justify-content-end">
                      <button
                        className="btn btn-outline-success"
                        title="Gera um link para um novo cliente se cadastrar e descrever o caso"
                        onClick={() => setShowNovoModal(true)}
                      >
                        <iconify-icon icon="solar:link-circle-linear" className="me-1" />
                        Intake — Novo Cliente
                      </button>
                      <button className="btn btn-primary" onClick={() => navigate('/clients/new')}>
                        + Novo Cliente
                      </button>
                    </div>
                  </div>

                  {carregando ? (
                    <div className="text-center py-4"><div className="spinner-border text-primary" /></div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover align-middle">
                        <thead>
                          <tr>
                            <th>Nome</th>
                            <th>CPF</th>
                            <th>Contato</th>
                            <th>Processos</th>
                            <th>Status</th>
                            <th>Cadastro</th>
                            <th>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientes.length === 0 ? (
                            <tr><td colSpan={7} className="text-center text-muted py-4">Nenhum cliente encontrado</td></tr>
                          ) : clientes.map(c => (
                            <tr key={c.id}>
                              <td className="fw-medium">{c.full_name}</td>
                              <td className="text-muted">{c.cpf ? mascararCPF(c.cpf) : '—'}</td>
                              <td className="text-muted">{c.whatsapp || c.phone || c.email || '—'}</td>
                              <td>{c._count?.processes ?? 0}</td>
                              <td>
                                <span className={`badge ${c.status === 'ativo' ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}`}>
                                  {c.status}
                                </span>
                              </td>
                              <td className="text-muted fs-13">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                              <td>
                                <div className="d-flex gap-1">
                                  <button className="btn btn-sm btn-outline-secondary" title="Ver ficha" onClick={() => navigate(`/clients/${c.id}`)}>
                                    <iconify-icon icon="solar:eye-linear" />
                                  </button>
                                  <button className="btn btn-sm btn-outline-secondary" title="Editar" onClick={() => navigate(`/clients/${c.id}/edit`)}>
                                    <iconify-icon icon="solar:pen-linear" />
                                  </button>
                                  <button
                                    className="btn btn-sm btn-outline-primary"
                                    title="Gerar link intake para este cliente atualizar dados"
                                    onClick={() => void gerarLinkIntakeCliente(c.id)}
                                  >
                                    <iconify-icon icon="solar:link-circle-linear" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {pages > 1 && (
                    <div className="d-flex justify-content-between align-items-center mt-3">
                      <small className="text-muted">{total} cliente(s) encontrado(s)</small>
                      <ul className="pagination pagination-sm mb-0">
                        <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
                          <button className="page-link" onClick={() => setPage(p => p - 1)}>‹</button>
                        </li>
                        {Array.from({ length: Math.min(5, pages) }, (_, i) => i + 1).map(p => (
                          <li key={p} className={`page-item ${p === page ? 'active' : ''}`}>
                            <button className="page-link" onClick={() => setPage(p)}>{p}</button>
                          </li>
                        ))}
                        <li className={`page-item ${page >= pages ? 'disabled' : ''}`}>
                          <button className="page-link" onClick={() => setPage(p => p + 1)}>›</button>
                        </li>
                      </ul>
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal — Intake Novo Cliente */}
      {showNovoModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Intake — Novo Cliente</h5>
                <button className="btn-close" onClick={fecharNovoModal} />
              </div>
              {novoLink ? (
                <div className="modal-body">
                  <div className="alert alert-success">
                    <iconify-icon icon="solar:check-circle-linear" className="me-2" />
                    Link gerado com sucesso!
                  </div>
                  <p className="text-muted fs-13 mb-2">Envie este link ao cliente para que ele preencha os dados:</p>
                  <div className="input-group">
                    <input className="form-control form-control-sm" readOnly value={novoLink} />
                    <button
                      className="btn btn-outline-secondary"
                      onClick={() => { void navigator.clipboard.writeText(novoLink); alert('Link copiado!') }}
                    >
                      <iconify-icon icon="solar:copy-linear" />
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={e => void handleNovoIntakeSubmit(e)}>
                  <div className="modal-body">
                    <p className="text-muted fs-13 mb-3">
                      Preencha os dados iniciais do cliente. Um link único será gerado para ele completar o cadastro.
                    </p>
                    <div className="mb-3">
                      <label className="form-label">Nome completo *</label>
                      <input
                        className="form-control"
                        required
                        value={novoForm.name}
                        onChange={e => setNovoForm(p => ({ ...p, name: e.target.value }))}
                        placeholder="Nome do cliente"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">WhatsApp</label>
                      <input
                        className="form-control"
                        value={novoForm.whatsapp}
                        onChange={e => setNovoForm(p => ({ ...p, whatsapp: e.target.value }))}
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Título do caso (opcional)</label>
                      <input
                        className="form-control"
                        value={novoForm.case_title}
                        onChange={e => setNovoForm(p => ({ ...p, case_title: e.target.value }))}
                        placeholder="Ex: Ação indenizatória por dano moral"
                      />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-outline-secondary" onClick={fecharNovoModal}>Cancelar</button>
                    <button type="submit" className="btn btn-success" disabled={novoLoading}>
                      {novoLoading ? 'Gerando...' : 'Gerar Link'}
                    </button>
                  </div>
                </form>
              )}
              {novoLink && (
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={fecharNovoModal}>Fechar</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
